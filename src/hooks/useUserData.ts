import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Position, TradeRecord } from '../types';

export function useUserData() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);

  const [cash, setCash] = useState<number>(100000);
  const [positions, setPositions] = useState<{ [key: string]: Position }>({
    btcusdt: { symbol: 'BTCUSDT', amount: 0, investedAmount: 0 },
    ethusdt: { symbol: 'ETHUSDT', amount: 0, investedAmount: 0 },
    solusdt: { symbol: 'SOLUSDT', amount: 0, investedAmount: 0 },
    bnbusdt: { symbol: 'BNBUSDT', amount: 0, investedAmount: 0 },
  });
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('btcusdt');
  const [selectedInterval, setSelectedInterval] = useState<string>('1s');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const userRef = doc(db, 'users', user.uid);
    
    const unsubUser = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.cash !== undefined) setCash(data.cash);
        if (data.positions) setPositions(data.positions);
        if (data.selectedAsset) setSelectedAssetId(data.selectedAsset);
        if (data.selectedInterval) setSelectedInterval(data.selectedInterval);
      } else {
        // Initialize user doc
        setDoc(userRef, {
          cash: 100000,
          positions: {
            btcusdt: { symbol: 'BTCUSDT', amount: 0, investedAmount: 0 },
            ethusdt: { symbol: 'ETHUSDT', amount: 0, investedAmount: 0 },
            solusdt: { symbol: 'SOLUSDT', amount: 0, investedAmount: 0 },
            bnbusdt: { symbol: 'BNBUSDT', amount: 0, investedAmount: 0 },
          },
          selectedAsset: 'btcusdt',
          selectedInterval: '1s'
        }, { merge: true });
      }
      setLoading(false);
    });

    const historyRef = doc(db, 'users', user.uid, 'data', 'history');
    const unsubHistory = onSnapshot(historyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.records) {
          setTradeHistory(data.records);
        }
      } else {
        setDoc(historyRef, { records: [] });
      }
    });

    return () => {
      unsubUser();
      unsubHistory();
    };
  }, [user]);

  const updateUserData = async (updates: any) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, updates, { merge: true });
  };

  const updateCashAndPositions = async (newCash: number, newPositions: any, newHistory: TradeRecord[]) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      cash: newCash,
      positions: newPositions
    }, { merge: true });

    const historyRef = doc(db, 'users', user.uid, 'data', 'history');
    await setDoc(historyRef, { records: newHistory }, { merge: true });
  };

  return {
    user,
    loading,
    cash,
    positions,
    tradeHistory,
    selectedAssetId,
    selectedInterval,
    updateUserData,
    updateCashAndPositions
  };
}
