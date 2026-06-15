import React, { useState, useEffect } from 'react';
import { Toilet } from './types';
import { TOILET_CATALOG, ARMOR_CATALOG } from './data';
import GameArea from './components/GameArea';
import { 
  Sparkles, Trash2, HelpCircle, Trophy, Award, Heart, ShieldCheck, Zap, User, LogOut, LogIn, Users, 
  AlertCircle, Cloud, CheckCircle2, Lock, Mail, Loader2, Bell, RefreshCw, Rss
} from 'lucide-react';
import { getCookie, setCookie, eraseCookie } from './utils/cookies';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './utils/firebase';

export default function App() {
  const [cookiesAccepted, setCookiesAccepted] = useState<boolean>(() => {
    return getCookie('poop_quest_cookie_consent') === 'true';
  });

  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState<boolean>(false);
  const [googleSubLog, setGoogleSubLog] = useState<string>('');

  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    // Check custom cookie first since user explicitly requested cookies for signing in with an account, then fallback
    const cookieUser = getCookie('poop_quest_current_user');
    if (cookieUser) return cookieUser;
    return localStorage.getItem('poop_quest_current_user');
  });

  // --- Firebase Cloud Save States ---
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isCloudUser, setIsCloudUser] = useState<boolean>(false);
  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string | null>(null);
  const [fbEmail, setFbEmail] = useState<string>('');
  const [fbPassword, setFbPassword] = useState<string>('');
  const [subbedTo, setSubbedTo] = useState<string[]>([]);
  const [tempSubbedTo, setTempSubbedTo] = useState<string[]>([]);
  const [authCategory, setAuthCategory] = useState<'cloud' | 'local'>('cloud');

  const creatorChoices = [
    { id: '@Cowguy55', name: 'Cowguy55 (Ultimate Toilet Dev)', icon: '🐄' },
    { id: '@PoopHero', name: 'Poop Hero VIP Club', icon: '💩' },
    { id: '@BidetLord', name: 'Bidet Lord & Bidet Inspector', icon: '🚽' },
    { id: '@SewerSage', name: 'Sewer Sage Lore Keeper', icon: '🧻' }
  ];

  const [profilesList, setProfilesList] = useState<string[]>(() => {
    const saved = localStorage.getItem('poop_quest_profiles_list');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const handleGoogleMessage = async (e: MessageEvent) => {
      // Validate origin
      const origin = e.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }

      if (e.data?.type === 'OAUTH_GOOGLE_SUCCESS') {
        const code = e.data.code;
        if (!code) return;

        try {
          setIsVerifyingGoogle(true);
          setGoogleSubLog("Handshaking with Google Session APIs...");
          
          const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, origin: window.location.origin })
          });

          if (!response.ok) {
            throw new Error(`Authentication code rejected by server environment`);
          }

          const verifyData = await response.json();
          if (verifyData.success) {
            setGoogleSubLog(verifyData.youtubeLog || "Profile successfully secured!");
            
            // Log in as Google User
            const googleUsername = verifyData.user || "Google Plumber";
            
            // Add to profiles list if doesn't exist
            let newList = [...profilesList];
            if (!newList.includes(googleUsername)) {
              newList.push(googleUsername);
              setProfilesList(newList);
              localStorage.setItem('poop_quest_profiles_list', JSON.stringify(newList));
            }

            // Set current user cookies
            setCurrentUser(googleUsername);
            localStorage.setItem('poop_quest_current_user', googleUsername);
            setCookie('poop_quest_current_user', googleUsername, 30);
            setCookie('poop_quest_is_google_user', 'true', 30);

            if (verifyData.subscribed) {
              setCookie('cowguy_subscribed_token', 'COW55_LEGENDARY_ACTIVE', 30);
              setCookie(`cowguy_subscribed_account_${googleUsername}`, '@YourGoogleAccount', 30);
            } else {
              eraseCookie('cowguy_subscribed_token');
            }

            // Dynamic chime
            import('./utils/audio').then(m => m.playUnlockSound());
          } else {
            setGoogleSubLog("Verification rejected by secure YouTube sub protocols.");
          }
        } catch (err: any) {
          console.error("Google verify error:", err);
          setGoogleSubLog(`Error: ${err.message || 'Handshake failed'}`);
        } finally {
          setIsVerifyingGoogle(false);
        }
      }
    };

    window.addEventListener('message', handleGoogleMessage);
    return () => window.removeEventListener('message', handleGoogleMessage);
  }, [profilesList]);

  const [coins, setCoins] = useState<number>(0);
  const [unlockedToilets, setUnlockedToilets] = useState<string[]>(['porta_potty']);
  const [activeToiletId, setActiveToiletId] = useState<string>('porta_potty');
  const [poopLevel, setPoopLevel] = useState<number>(1);
  const [suitLevel, setSuitLevel] = useState<number>(1);
  const [unlockedArmors, setUnlockedArmors] = useState<string[]>(['basic_poncho']);
  const [activeArmorId, setActiveArmorId] = useState<string>('basic_poncho');
  const [highScore, setHighScore] = useState<number>(0);

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem('poop_quest_muted');
    return saved ? saved === 'true' : false;
  });

  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; isError: boolean } | null>(null);
  
  const [newUsername, setNewUsername] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [selectedLoginProfile, setSelectedLoginProfile] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRegisteringMode, setIsRegisteringMode] = useState<boolean>(false);

  // --- Test Connection & Listen to Auth State ---
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    // Firebase Auth listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        setIsCloudUser(true);
        setCurrentUser(user.email); // Set the game player to be the Cloud user email!
        
        try {
          setIsCloudLoading(true);
          const userRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userRef);
          
          if (snap.exists()) {
            const data = snap.data();
            // Load state variables from Firestore
            setCoins(data.coins ?? 0);
            setUnlockedToilets(data.unlockedToilets ?? ['porta_potty']);
            setActiveToiletId(data.activeToiletId ?? 'porta_potty');
            setUnlockedArmors(data.unlockedArmors ?? ['basic_poncho']);
            setActiveArmorId(data.activeArmorId ?? 'basic_poncho');
            setPoopLevel(data.poopLevel ?? 1);
            setSuitLevel(data.suitLevel ?? 1);
            setHighScore(data.highScore ?? 0);
            setSubbedTo(data.subbedTo ?? []);
            setCloudSyncStatus('State Loaded ☁️');
          } else {
            // First time Cloud Register - we write their current state to Firestore
            // This is super neat since it doesn't delete their current local stats if they just signed up!
            const initialPayload = {
              uid: user.uid,
              email: user.email || '',
              highScore: highScore,
              coins: coins,
              subbedTo: subbedTo,
              unlockedToilets: unlockedToilets,
              activeToiletId: activeToiletId,
              unlockedArmors: unlockedArmors,
              activeArmorId: activeArmorId,
              poopLevel: poopLevel,
              suitLevel: suitLevel,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            await setDoc(userRef, initialPayload);
            setCloudSyncStatus('Profile Created ☁️');
          }
        } catch (err: any) {
          console.error("Error fetching cloud profile:", err);
          try {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          } catch (handlingErr: any) {
            setAuthError(`Cloud load error: ${handlingErr.message}`);
          }
        } finally {
          setIsCloudLoading(false);
        }
      } else {
        setFirebaseUser(null);
        setIsCloudUser(false);
        setCloudSyncStatus(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // --- Auto-Save State variables to Firestore DB with a gentle 1.5s debounce ---
  useEffect(() => {
    if (!firebaseUser) return;
    
    const timer = setTimeout(async () => {
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        await updateDoc(userRef, {
          highScore,
          coins,
          subbedTo,
          unlockedToilets,
          activeToiletId,
          unlockedArmors,
          activeArmorId,
          poopLevel,
          suitLevel,
          updatedAt: serverTimestamp()
        });
        setCloudSyncStatus('Synced ✓');
      } catch (err: any) {
        console.error("Auto-sync error:", err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [coins, unlockedToilets, activeToiletId, unlockedArmors, activeArmorId, poopLevel, suitLevel, highScore, subbedTo, firebaseUser]);

  // Load profile state when currentUser changes
  useEffect(() => {
    if (isCloudUser) return; // Skip local storage loading if authenticated online!
    if (currentUser) {
      const savedCoins = localStorage.getItem(`poop_quest_coins_${currentUser}`);
      setCoins(savedCoins ? parseInt(savedCoins, 10) : 0);

      const savedUnlocked = localStorage.getItem(`poop_quest_unlocked_${currentUser}`);
      setUnlockedToilets(savedUnlocked ? JSON.parse(savedUnlocked) : ['porta_potty']);

      const savedActive = localStorage.getItem(`poop_quest_active_id_${currentUser}`);
      setActiveToiletId(savedActive || 'porta_potty');

      const savedUnlockedArmors = localStorage.getItem(`poop_quest_unlocked_armors_${currentUser}`);
      setUnlockedArmors(savedUnlockedArmors ? JSON.parse(savedUnlockedArmors) : ['basic_poncho']);

      const savedActiveArmor = localStorage.getItem(`poop_quest_active_armor_id_${currentUser}`);
      setActiveArmorId(savedActiveArmor || 'basic_poncho');

      const savedLevel = localStorage.getItem(`poop_quest_level_${currentUser}`);
      setPoopLevel(savedLevel ? parseInt(savedLevel, 10) : 1);

      const savedSuitLevel = localStorage.getItem(`poop_quest_suit_level_${currentUser}`);
      setSuitLevel(savedSuitLevel ? parseInt(savedSuitLevel, 10) : 1);

      const savedHighScore = localStorage.getItem(`poop_quest_highscore_${currentUser}`);
      setHighScore(savedHighScore ? parseInt(savedHighScore, 10) : 0);
    } else {
      setCoins(0);
      setUnlockedToilets(['porta_potty']);
      setActiveToiletId('porta_potty');
      setUnlockedArmors(['basic_poncho']);
      setActiveArmorId('basic_poncho');
      setPoopLevel(1);
      setSuitLevel(1);
      setHighScore(0);
    }
  }, [currentUser]);

  // Sync state helpers to localStorage on change if currentUser exists
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`poop_quest_coins_${currentUser}`, coins.toString());
    }
  }, [coins, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`poop_quest_unlocked_${currentUser}`, JSON.stringify(unlockedToilets));
    }
  }, [unlockedToilets, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`poop_quest_active_id_${currentUser}`, activeToiletId);
    }
  }, [activeToiletId, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`poop_quest_unlocked_armors_${currentUser}`, JSON.stringify(unlockedArmors));
    }
  }, [unlockedArmors, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`poop_quest_active_armor_id_${currentUser}`, activeArmorId);
    }
  }, [activeArmorId, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`poop_quest_level_${currentUser}`, poopLevel.toString());
    }
  }, [poopLevel, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`poop_quest_suit_level_${currentUser}`, suitLevel.toString());
    }
  }, [suitLevel, currentUser]);

  useEffect(() => {
    localStorage.setItem('poop_quest_muted', isMuted ? 'true' : 'false');
  }, [isMuted]);

  // Auto-level up when all toilets in the current level are unlocked
  useEffect(() => {
    const currentExclusiveToilets = TOILET_CATALOG.filter(t => t.level === poopLevel && t.id !== 'cowguy_throne');
    if (currentExclusiveToilets.length > 0) {
      const allUnlocked = currentExclusiveToilets.every(t => unlockedToilets.includes(t.id));
      if (allUnlocked && poopLevel < 100) {
        setPoopLevel(prev => {
          const nextLvl = prev + 1;
          // Trigger a satisfying chime
          import('./utils/audio').then(m => m.playUnlockSound());
          return nextLvl;
        });
      }
    }
  }, [unlockedToilets, poopLevel]);

  // Auto-level up when all armors in the current suit level are unlocked
  useEffect(() => {
    const currentExclusiveArmors = ARMOR_CATALOG.filter(a => a.level === suitLevel && a.id !== 'cowguy_suit' && a.id !== 'basic_poncho');
    if (currentExclusiveArmors.length > 0) {
      const allUnlocked = currentExclusiveArmors.every(a => unlockedArmors.includes(a.id));
      if (allUnlocked && suitLevel < 100) {
        setSuitLevel(prev => {
          const nextLvl = prev + 1;
          // Trigger a satisfying chime
          import('./utils/audio').then(m => m.playUnlockSound());
          return nextLvl;
        });
      }
    }
  }, [unlockedArmors, suitLevel]);

  // Derive the active toilet configuration dictionary
  const activeToilet = TOILET_CATALOG.find(t => t.id === activeToiletId) || TOILET_CATALOG[0];

  const handleSetCoins = (amount: number) => {
    setCoins(prev => {
      const next = prev + amount;
      return next >= 0 ? next : 0;
    });
  };

  const handleUnlockToilet = (id: string, cost: number) => {
    if (coins >= cost && !unlockedToilets.includes(id)) {
      setCoins(prev => prev - cost);
      setUnlockedToilets(prev => [...prev, id]);
      setActiveToiletId(id);
    }
  };

  const handleSellToilet = (id: string, cost: number) => {
    if (unlockedToilets.includes(id) && activeToiletId !== id) {
      const refund = Math.floor(cost * 0.9);
      setCoins(prev => prev + refund);
      setUnlockedToilets(prev => prev.filter(t => t !== id));
    }
  };

  const handleApplyPromoCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const cleanCode = promoCode.trim();
    if (cleanCode.toLowerCase() === 'cowscribe') {
      if (unlockedToilets.includes('golden_stall')) {
        setPromoMessage({ text: 'Already unlocked! The Golden Toilet is waiting in your shop list! 🏆', isError: false });
        return;
      }
      setUnlockedToilets(prev => [...prev, 'golden_stall']);
      setActiveToiletId('golden_stall');
      setPromoMessage({ text: 'Success! Secret code activated! 24K Golden Urinal unlocked! 🏆✨', isError: false });
      setPromoCode('');
      // Trigger unlock sound if audio is initialized
      import('./utils/audio').then(m => m.playUnlockSound());
    } else {
      setPromoMessage({ text: `That is not the secret code. Try hinting around! 🧐`, isError: true });
    }
  };

  const handleGoogleSignInTrigger = async () => {
    try {
      setIsVerifyingGoogle(true);
      setGoogleSubLog("Querying backend for Google OAuth secure URL...");
      
      const res = await fetch(`/api/auth/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!res.ok) {
        throw new Error(`Failed to initialize Google login session`);
      }
      
      const data = await res.json();
      
      // Open the OAuth popup
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        data.url,
        "Google_OAuth_Sign_In",
        `width=${width},height=${height},left=${left},top=${top},status=yes,resizable=yes`
      );
      
      if (!popup) {
        alert("Pop-up blocker active! Please allow popups on this website to sign-in with Google.");
        setIsVerifyingGoogle(false);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error contacting backend: " + err.message);
      setIsVerifyingGoogle(false);
    }
  };

  const handleFirebaseRegister = async (emailInput: string, passInput: string, initialSubs: string[]) => {
    setAuthError(null);
    if (!emailInput || !emailInput.includes('@')) {
      setAuthError('Please enter a valid plumber email address!');
      return;
    }
    if (!passInput || passInput.length < 6) {
      setAuthError('Security password must be at least 6 characters for cloud save!');
      return;
    }

    try {
      setIsCloudLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, emailInput.trim(), passInput);
      const user = userCredential.user;
      
      // Save their profile document
      const userRef = doc(db, 'users', user.uid);
      const initialPayload = {
        uid: user.uid,
        email: user.email || '',
        highScore: highScore,
        coins: coins,
        subbedTo: initialSubs,
        unlockedToilets: unlockedToilets,
        activeToiletId: activeToiletId,
        unlockedArmors: unlockedArmors,
        activeArmorId: activeArmorId,
        poopLevel: poopLevel,
        suitLevel: suitLevel,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(userRef, initialPayload);
      setSubbedTo(initialSubs);
      setCloudSyncStatus('Profile Created ✓');
      setAuthError(null);
      import('./utils/audio').then(m => m.playUnlockSound());
    } catch (err: any) {
      console.error("Firebase SignUp Failed:", err);
      const errCode = err.code || '';
      const errMsg = err.message || '';
      if (errCode === 'auth/email-already-in-use' || errMsg.includes('email-already-in-use')) {
        setAuthError('This email is already registered! Try logging in under the "Cloud Login" tab instead.');
      } else if (errCode === 'auth/operation-not-allowed' || errMsg.includes('operation-not-allowed')) {
        setAuthError('⚠️ Email/Password authentication is disabled in Firebase! Please go to your Firebase Console > Authentication > Sign-in method tab, click "Add new provider", select "Email/Password", and enable it.');
      } else if (errCode === 'auth/weak-password') {
        setAuthError('Password is too weak. Choose at least 6 characters.');
      } else if (errCode === 'auth/invalid-email') {
        setAuthError('Invalid email format. Try again.');
      } else {
        setAuthError(errMsg || 'Cloud registration rejected.');
      }
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handleFirebaseLogin = async (emailInput: string, passInput: string) => {
    setAuthError(null);
    if (!emailInput || !passInput) {
      setAuthError('Please fill in both Email and Password fields!');
      return;
    }

    try {
      setIsCloudLoading(true);
      await signInWithEmailAndPassword(auth, emailInput.trim(), passInput);
      setAuthError(null);
      import('./utils/audio').then(m => m.playUnlockSound());
    } catch (err: any) {
      console.error("Firebase Login Failed:", err);
      const errCode = err.code || '';
      const errMsg = err.message || '';
      if (errCode === 'auth/operation-not-allowed' || errMsg.includes('operation-not-allowed')) {
        setAuthError('⚠️ Email/Password authentication is disabled in Firebase! Please go to your Firebase Console > Authentication > Sign-in method tab, click "Add new provider", select "Email/Password", and enable it.');
      } else {
        setAuthError('Incorrect email or password. Please verify your credentials.');
      }
      import('./utils/audio').then(m => m.playDamageSound());
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handleRegisterAccount = (nameInput: string, passInput: string) => {
    const cleanName = nameInput.trim();
    const cleanPass = passInput.trim();
    setAuthError(null);

    if (!cleanName || cleanName.length < 2 || cleanName.length > 15) {
      setAuthError('Sewer nickname must be between 2 and 15 characters!');
      return;
    }
    if (!cleanPass || cleanPass.length < 4) {
      setAuthError('Security password must be at least 4 characters long!');
      return;
    }

    const savedPasswords = JSON.parse(localStorage.getItem('poop_quest_user_passwords') || '{}');
    if (savedPasswords[cleanName.toLowerCase()]) {
      setAuthError('Nickname is already taken. Try logging in or use another!');
      return;
    }

    // Save credentials securely in localStorage
    savedPasswords[cleanName.toLowerCase()] = {
      username: cleanName,
      password: cleanPass
    };
    localStorage.setItem('poop_quest_user_passwords', JSON.stringify(savedPasswords));

    // Add to profiles list
    let newList = [...profilesList];
    if (!newList.includes(cleanName)) {
      newList.push(cleanName);
      setProfilesList(newList);
      localStorage.setItem('poop_quest_profiles_list', JSON.stringify(newList));
    }

    // Sign in active session
    setCurrentUser(cleanName);
    localStorage.setItem('poop_quest_current_user', cleanName);
    setCookie('poop_quest_current_user', cleanName);
    setNewUsername('');
    setPasswordInput('');
    setAuthError(null);

    // Play unlocking success sound
    import('./utils/audio').then(m => m.playUnlockSound());
  };

  const handleLoginAccount = (profileName: string, passInput: string) => {
    const cleanPass = passInput.trim();
    setAuthError(null);

    const savedPasswords = JSON.parse(localStorage.getItem('poop_quest_user_passwords') || '{}');
    const record = savedPasswords[profileName.toLowerCase()];

    if (!record) {
      // Legacy user who doesn't have a password yet. Allow them to establish a brand-new password!
      if (cleanPass.length < 4) {
        setAuthError('Create a security password (min 4 chars) to lock your legacy account!');
        return;
      }
      savedPasswords[profileName.toLowerCase()] = {
        username: profileName,
        password: cleanPass
      };
      localStorage.setItem('poop_quest_user_passwords', JSON.stringify(savedPasswords));
    } else if (record.password !== cleanPass) {
      setAuthError('Access Denied: Invalid security password for this profile!');
      import('./utils/audio').then(m => m.playDamageSound());
      return;
    }

    // Credentials passed! Set active session
    setCurrentUser(profileName);
    localStorage.setItem('poop_quest_current_user', profileName);
    setCookie('poop_quest_current_user', profileName);
    setSelectedLoginProfile(null);
    setPasswordInput('');
    setAuthError(null);

    import('./utils/audio').then(m => m.playUnlockSound());
  };

  const handleSignIn = (nameToSignIn: string) => {
    // Legacy helper fallback
    const cleanName = nameToSignIn.trim();
    if (!cleanName) return;

    let newList = [...profilesList];
    if (!newList.includes(cleanName)) {
      newList.push(cleanName);
      setProfilesList(newList);
      localStorage.setItem('poop_quest_profiles_list', JSON.stringify(newList));
    }

    setCurrentUser(cleanName);
    localStorage.setItem('poop_quest_current_user', cleanName);
    setCookie('poop_quest_current_user', cleanName);
  };

  const handleSignOut = () => {
    if (isCloudUser) {
      firebaseSignOut(auth).then(() => {
        // Reset local game states nicely
        setCoins(0);
        setUnlockedToilets(['porta_potty']);
        setActiveToiletId('porta_potty');
        setUnlockedArmors(['basic_poncho']);
        setActiveArmorId('basic_poncho');
        setPoopLevel(1);
        setSuitLevel(1);
        setHighScore(0);
        setSubbedTo([]);
        setCloudSyncStatus(null);
      }).catch(err => {
        console.error("Firebase Signout Error:", err);
      });
    }

    setCurrentUser(null);
    localStorage.removeItem('poop_quest_current_user');
    eraseCookie('poop_quest_current_user');
    eraseCookie('poop_quest_is_google_user');
    eraseCookie('cowguy_subscribed_token');
    setGoogleSubLog('');
  };

  const handleDeleteProfile = (profileToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to permanently delete profile "${profileToDelete}" and all its records?`)) {
      const newList = profilesList.filter(p => p !== profileToDelete);
      setProfilesList(newList);
      localStorage.setItem('poop_quest_profiles_list', JSON.stringify(newList));
      
      // Wipe storage variables for this deleted user
      localStorage.removeItem(`poop_quest_coins_${profileToDelete}`);
      localStorage.removeItem(`poop_quest_unlocked_${profileToDelete}`);
      localStorage.removeItem(`poop_quest_active_id_${profileToDelete}`);
      localStorage.removeItem(`poop_quest_highscore_${profileToDelete}`);
      
      if (currentUser === profileToDelete) {
        handleSignOut();
      }
    }
  };

  const handleHighScoreChange = (newHighScore: number) => {
    if (currentUser) {
      setHighScore(newHighScore);
      localStorage.setItem(`poop_quest_highscore_${currentUser}`, newHighScore.toString());
    }
  };

  const handleResetProgressOnly = () => {
    if (!currentUser) return;
    if (window.confirm(`Are you sure you want to scrub ALL plumbing progress for profile "${currentUser}" and start back as a rusty porta-potty?`)) {
      setCoins(0);
      setUnlockedToilets(['porta_potty']);
      setActiveToiletId('porta_potty');
      setHighScore(0);
      
      localStorage.removeItem(`poop_quest_coins_${currentUser}`);
      localStorage.removeItem(`poop_quest_unlocked_${currentUser}`);
      localStorage.removeItem(`poop_quest_active_id_${currentUser}`);
      localStorage.removeItem(`poop_quest_highscore_${currentUser}`);
      
      alert(`Progress for profile "${currentUser}" has been wiped clean! 🧼`);
    }
  };

  if (!cookiesAccepted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 font-mono select-none">
        <div className="max-w-md w-full bg-slate-900 border-2 border-dashed border-amber-500/40 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-center animate-fade-in animate-duration-500">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="inline-flex p-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-2xl mb-5">
            <ShieldCheck className="w-10 h-10 animate-pulse" />
          </div>
          
          <h2 className="text-xl font-black uppercase text-amber-400 tracking-tight leading-none mb-2">
            🍪 Cookie Integrity Gate
          </h2>
          <div className="text-[10px] text-amber-500/80 uppercase font-bold tracking-wider mb-4 border border-amber-500/20 px-2.5 py-1 rounded-full inline-block">
            Required for Cross-Origin Sandbox Preview
          </div>
          
          <p className="text-xs text-slate-300 leading-relaxed mb-6 text-left">
            To play <strong>Poop Toilet Quest</strong>, register profiles, and securely connect with Google Auth for YouTube verification, you must authorize our essential cookie tokens.
            <br /><br />
            Because this arcade is running in an <strong>iframe sandbox</strong>, secure cross-origin flags (<code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-bold">SameSite=None; Secure</code>) must be stored on your browser to:
          </p>
          
          <ul className="text-[11px] text-slate-400 text-left space-y-2 mb-6 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 font-bold">✔</span>
              <span><strong>Google OpenID Session:</strong> Validates secure accounts within popup scopes.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5 font-bold">✔</span>
              <span><strong>YouTube Subscription Token:</strong> Verifies the @Cowguy55 reward status.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5 font-bold">✔</span>
              <span><strong>Plumbing Register:</strong> Persists save-files, coins, and Stall progress.</span>
            </li>
          </ul>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setCookie('poop_quest_cookie_consent', 'true', 30);
                setCookiesAccepted(true);
              }}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10 cursor-pointer text-xs"
            >
              Consent & Begin Play 🎮
            </button>
            <button
              onClick={() => {
                alert("Sewer gate closed! You cannot access the plumbing registry without cookies activated.");
              }}
              className="px-4 py-3 bg-slate-950/60 hover:bg-slate-950 text-slate-500 hover:text-slate-350 border border-slate-800 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Decline Access
            </button>
          </div>
          
          <div className="mt-5 text-[9px] text-slate-500">
            🌍 Security standards of the Deep Sea Sewer Network, 2026.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-900">
      
      {/* Decorative overhead subtle grid banner */}
      <header className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl animate-spin-slow">💩</span>
            <div>
              <span className="text-md font-mono font-black tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-cyan-400 bg-clip-text text-transparent uppercase">
                POOP TOILET QUEST
              </span>
              <div className="text-[10px] font-mono font-medium text-slate-500 tracking-wider">
                FROM PLUMBING TO PORCELAIN
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentUser && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
                <User className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-slate-200 font-bold max-w-[120px] truncate">{currentUser}</span>
                <button
                  onClick={handleSignOut}
                  className="ml-1.5 text-[10px] text-rose-400 hover:text-rose-350 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                  title="Sign Out of Profile"
                >
                  <LogOut className="w-2.5 h-2.5" /> Out
                </button>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(true)}
              className="text-xs font-mono font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 transition-all duration-200"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Lore Guide
            </button>

            <button
              onClick={handleResetProgressOnly}
              className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-505/5 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/10 transition-all duration-200"
              title="Reset Saved Progress Data"
            >
              <Trash2 className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>
      </header>

      {/* Arcade Multi-Profile Selector Section when no currentUser */}
      {!currentUser ? (
        <main className="max-w-md w-full mx-auto px-4 py-12 flex-1 flex flex-col justify-center items-center">
          <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="text-center mb-6">
              <div className="inline-flex p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl mb-4">
                <User className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-mono font-black uppercase text-amber-400 tracking-tight">
                Plumber Arcade Registry
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1 leading-relaxed">
                Sign in with an account or register below. Create a safe password to secure your coins, high scores, and toilet progress!
              </p>
            </div>

            {/* Diagnostic & Auth Warnings */}
            {authError && (
              <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-mono rounded-xl flex items-start gap-2.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 animate-pulse mt-0.5" />
                <span className="flex-1 font-bold">{authError}</span>
              </div>
            )}

            {/* Main Auth Category Selector */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850 mb-5 font-mono">
              <button
                type="button"
                onClick={() => {
                  setAuthCategory('cloud');
                  setAuthError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase ${
                  authCategory === 'cloud' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" /> Cloud Save DB
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthCategory('local');
                  setAuthError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase ${
                  authCategory === 'local' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Local Registry
              </button>
            </div>

            {authCategory === 'cloud' ? (
              /* ================== CLOUD SYNCHRONIZATION FORM (FIREBASE AUTH & FIRESTORE) ================== */
              <div className="space-y-4">
                {/* Cloud Register/Login nested tabber */}
                <div className="flex bg-slate-950/60 p-1 rounded-lg border border-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisteringMode(false);
                      setAuthError(null);
                    }}
                    className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                      !isRegisteringMode ? 'bg-slate-900 border border-slate-800 text-amber-400 font-extrabold' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    🔐 Cloud Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisteringMode(true);
                      setAuthError(null);
                    }}
                    className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                      isRegisteringMode ? 'bg-slate-900 border border-slate-800 text-amber-400 font-extrabold' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    🏆 Cloud Register
                  </button>
                </div>

                <div className="text-[10px] bg-amber-500/5 border border-amber-500/15 text-amber-500/95 rounded-xl p-3 leading-relaxed font-mono">
                  💡 **Firebase Console Note:** Ensure that <strong>Email/Password Sign-In Provider</strong> is enabled in the Firebase Console (under Authentication Tab) to support email registries of players!
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (isRegisteringMode) {
                      await handleFirebaseRegister(fbEmail, fbPassword, tempSubbedTo);
                    } else {
                      await handleFirebaseLogin(fbEmail, fbPassword);
                    }
                  }}
                  className="space-y-4 font-mono"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Sync Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={fbEmail}
                        onChange={(e) => setFbEmail(e.target.value)}
                        placeholder="plumber@porcelain-safe.com"
                        className="w-full bg-slate-955 bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 text-xs tracking-wide"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Secret Cloud Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={fbPassword}
                        onChange={(e) => setFbPassword(e.target.value)}
                        placeholder="•••••• Must be at least 6 chars"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 text-xs tracking-wide"
                      />
                    </div>
                  </div>

                  {/* WHO ARE THEY SUBBED TO - Only visible for Registration */}
                  {isRegisteringMode && (
                    <div className="space-y-2 border border-slate-850 bg-slate-950/60 p-3 rounded-xl animate-fade-in animate-duration-300">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Bell className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> Which creators do you subscribe to?
                      </div>
                      <p className="text-[9px] text-slate-400 leading-snug">
                        Let us know who you are supporting! This syncs to your secure Firestore document back to base!
                      </p>
                      
                      <div className="space-y-2 pt-1 font-mono">
                        {creatorChoices.map((creator) => {
                          const isChecked = tempSubbedTo.includes(creator.id);
                          return (
                            <label
                              key={creator.id}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border text-[11px] ${
                                isChecked 
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200' 
                                  : 'bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{creator.icon}</span>
                                <span>{creator.name}</span>
                              </div>
                              <input
                                type="checkbox"
                                value={creator.id}
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setTempSubbedTo(tempSubbedTo.filter(id => id !== creator.id));
                                  } else {
                                    setTempSubbedTo([...tempSubbedTo, creator.id]);
                                  }
                                }}
                                className="accent-amber-500 h-3.5 w-3.5 cursor-pointer rounded border-slate-800"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isCloudLoading}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/5 uppercase font-mono tracking-wider"
                  >
                    {isCloudLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Synchronizing Cloud DB...</span>
                      </>
                    ) : isRegisteringMode ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        <span>Create DB Profile & Save Stats 🏆</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        <span>Verify Credentials & Load 🔐</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Sub status details disclaimer */}
                <div className="text-[10px] text-center text-slate-500 leading-normal border-t border-slate-850 pt-3">
                  🌥️ Firestore Zero-trust security locks down your game-saves via owners authentication policies.
                </div>
              </div>
            ) : (
              /* ================== OFFLINE/LOCAL ACCOUNT REGISTRY (OLD BEHAVIOR) ================== */
              <div className="space-y-4 animate-fade-in animate-duration-300">
                {/* Local Register/Login tabs */}
                <div className="flex bg-slate-950/60 p-1 rounded-lg border border-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisteringMode(false);
                      setAuthError(null);
                      setSelectedLoginProfile(null);
                      setPasswordInput('');
                    }}
                    className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                      !isRegisteringMode ? 'bg-slate-900 border border-slate-800 text-amber-400 font-extrabold' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    🔐 Local Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisteringMode(true);
                      setAuthError(null);
                      setSelectedLoginProfile(null);
                      setPasswordInput('');
                    }}
                    className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                      isRegisteringMode ? 'bg-slate-900 border border-slate-800 text-amber-400 font-extrabold' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    🏆 Local Register
                  </button>
                </div>

                {!isRegisteringMode ? (
                  /* LOCAL LOGIN TAB */
                  <div className="space-y-4">
                    {profilesList.length > 0 ? (
                      <div className="p-4 bg-slate-950/85 border border-slate-850 rounded-xl">
                        <div className="text-[10px] font-mono font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-3">
                          <Users className="w-3.5 h-3.5 text-cyan-400" /> Choose Local Profile ({profilesList.length})
                        </div>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                          {profilesList.map((profile) => {
                            const savedHigh = localStorage.getItem(`poop_quest_highscore_${profile}`) || '0';
                            const isChosen = selectedLoginProfile === profile;
                            return (
                              <div
                                key={profile}
                                onClick={() => {
                                  setSelectedLoginProfile(profile);
                                  setPasswordInput('');
                                  setAuthError(null);
                                }}
                                className={`cursor-pointer group flex items-center justify-between p-2.5 rounded-lg transition-all text-xs font-mono border ${
                                  isChosen 
                                    ? 'bg-slate-850 border-amber-500 shadow-md animate-pulse' 
                                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-cyan-500/30'
                                }`}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="text-slate-400 font-bold group-hover:text-cyan-400">👤</span>
                                  <span className="truncate text-slate-200 group-hover:text-white font-bold">{profile}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[9px] text-slate-500 font-bold">
                                    Record: {savedHigh} Kills
                                  </span>
                                  <button
                                    onClick={(e) => handleDeleteProfile(profile, e)}
                                    className="p-1 text-slate-550 text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 rounded transition-all"
                                    title="Delete Profile"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-xl text-center text-xs font-mono text-slate-500">
                        No offline profiles loaded yet. Switch local tab to "🏆 Local Register"!
                      </div>
                    )}

                    {selectedLoginProfile && (
                      <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3.5 animate-fade-in">
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                          <span>🔒</span> Security Password for <strong className="text-white">{selectedLoginProfile}</strong>
                        </div>
                        <form 
                          onSubmit={(e) => { 
                            e.preventDefault(); 
                            handleLoginAccount(selectedLoginProfile, passwordInput); 
                          }} 
                          className="space-y-3"
                        >
                          <input
                            type="password"
                            required
                            autoFocus
                            placeholder="Type Local Security Password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 text-xs font-mono"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs font-mono cursor-pointer transition-colors"
                            >
                              Authorize Access 🔐
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedLoginProfile(null); setPasswordInput(''); setAuthError(null); }}
                              className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 rounded-lg text-xs font-mono cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  /* LOCAL REGISTER TAB */
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRegisterAccount(newUsername, passwordInput);
                    }}
                    className="space-y-4 font-mono"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Choose Plumber Nickname
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={15}
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g. SewerSurfer"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 text-sm font-mono tracking-wide"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Set security Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={4}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="•••• Must be min 4 characters"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 text-sm font-mono tracking-wide"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-amber-500 hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/5 text-slate-950 font-bold rounded-xl transition-all duration-150 text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogIn className="w-4 h-4 text-slate-950" /> Register Local Profile 🏆
                    </button>
                  </form>
                )}

                <div className="mt-5 text-[10px] text-center text-slate-500 font-mono border-t border-slate-850 pt-3">
                  ⚡ Offline registries are stored securely in this local browser session.
                </div>
              </div>
            )}

            {/* Visual Divider */}
            <div className="relative my-5 flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">or integrate</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Google Sign-In with perfect YouTube Access */}
            <div className="space-y-3 font-mono">
              <button
                onClick={handleGoogleSignInTrigger}
                disabled={isVerifyingGoogle}
                type="button"
                className="w-full py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-red-500/40 text-slate-200 hover:text-white font-bold rounded-xl transition-all duration-150 text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="text-red-500 text-sm">🔺</span> 
                {isVerifyingGoogle ? "Establishing Handshake..." : "Sign In with Google Account"}
              </button>
              
              <div className="text-[10px] text-slate-400 font-mono text-center leading-normal">
                Prerequisite to check your YouTube channel subscription securely!
              </div>

              {googleSubLog && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 font-mono text-[9px] text-left leading-relaxed text-cyan-400 max-h-24 overflow-y-auto">
                  <div className="text-amber-500 font-bold text-[8px] uppercase tracking-wider mb-1">
                    Google Handshake Console
                  </div>
                  {googleSubLog}
                </div>
              )}
            </div>

            <div className="mt-5 text-[10px] text-center text-slate-500 font-mono">
              ⚡ Local offline profiles. Your adventure records save instantly!
            </div>
          </div>
        </main>
      ) : (
        <>
          {/* Responsive user-profile details for small viewports */}
          <div className="sm:hidden bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-slate-800 text-xs font-mono">
            <span className="text-slate-400">👤 Active Profile: <strong className="text-white">{currentUser}</strong></span>
            <button
              onClick={handleSignOut}
              className="text-[10px] text-rose-400 hover:text-rose-350 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
            >
              <LogOut className="w-2.5 h-2.5" /> Sign Out
            </button>
          </div>

          {/* Code Guessing Sticky Banner on Top of Main Screen */}
          <div className="bg-gradient-to-r from-amber-500/10 to-slate-900 border-b border-amber-500/15 py-3 px-4">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
              <div className="flex items-center gap-2.5 text-amber-400 font-bold">
                <span className="text-base animate-pulse">🕵️‍♂️🚽</span>
                <span>Secret Toilet Code Finder: Can you guess the secret password to instantly summon the 24K Golden Toilet?</span>
              </div>

              <form onSubmit={handleApplyPromoCode} className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <input
                  type="text"
                  placeholder="What is the code?..."
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 text-xs w-full sm:w-48 font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-all duration-150 text-xs shrink-0 cursor-pointer shadow-md"
                >
                  Submit
                </button>
              </form>
            </div>
            {promoMessage && (
              <div className="max-w-7xl mx-auto mt-2 text-center text-xs font-mono animate-fade-in">
                <span className={`px-3 py-1 rounded inline-block ${promoMessage.isError ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {promoMessage.text}
                </span>
              </div>
            )}
          </div>

          {/* Main Container Wrapper */}
          <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-6">
            
            {/* Decorative dynamic header banner informing player of core goals */}
            <div className="relative overflow-hidden bg-gradient-to-r from-amber-950/10 via-slate-900 to-cyan-950/10 border border-slate-850 rounded-2xl p-6 md:p-8 shadow-xl animate-fade-in">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="max-w-xl">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full mb-3">
                    <Sparkles className="w-3 h-3" /> Live Arcade Quest
                  </span>
                  <h2 className="text-xl md:text-2xl font-bold font-mono text-slate-100 mb-2">
                    Flush Away the Sanitary Patrol!
                  </h2>
                  <p className="text-slate-400 text-xs md:text-sm leading-relaxed max-w-lg">
                    Walk across the tiled world, snap up the shiny gold pieces dropped around the map, and invest them in the shop to purchase high-tech bidets. The better your equipped toilet is, the more damage your flushes deal to active foes!
                  </p>
                </div>

                <div className="bg-slate-950/90 border border-slate-800 p-4 rounded-xl min-w-[200px] flex flex-col gap-2 font-mono">
                  <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1 font-bold">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" /> Historic Peak Records
                  </div>
                  <div className="text-2xl font-bold font-mono text-yellow-400">
                    {highScore} <span className="text-xs text-slate-400 font-normal italic">kills</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal max-w-[220px]">
                    Unlock every toilet in your current Sewer Zone to level up! Advance through all 100 levels!
                  </p>
                </div>
              </div>
            </div>

            {/* Master Game loop engine area inside the page grid */}
            <section className="flex-1 flex flex-col animate-fade-in">
              <GameArea
                coins={coins}
                addCoins={handleSetCoins}
                unlockedToilets={unlockedToilets}
                setUnlockedToilets={setUnlockedToilets}
                unlockToilet={handleUnlockToilet}
                sellToilet={handleSellToilet}
                activeToilet={activeToilet}
                setActiveToilet={(toilet) => setActiveToiletId(toilet.id)}
                setActiveToiletId={setActiveToiletId}
                isMuted={isMuted}
                setIsMuted={setIsMuted}
                highScore={highScore}
                onHighScoreChange={handleHighScoreChange}
                poopLevel={poopLevel}
                setPoopLevel={setPoopLevel}
                suitLevel={suitLevel}
                setSuitLevel={setSuitLevel}
                unlockedArmors={unlockedArmors}
                setUnlockedArmors={setUnlockedArmors}
                activeArmorId={activeArmorId}
                setActiveArmorId={setActiveArmorId}
                currentUser={currentUser}
              />
            </section>

          </main>
        </>
      )}

      {/* Decorative Interactive Modal for Poop Lore Guide */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
            
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 text-slate-950 flex justify-between items-center bg-cover">
              <div className="flex items-center gap-2">
                <span className="text-3xl">🧻</span>
                <div>
                  <h3 className="font-mono font-bold leading-tight">POOP QUEST KNOWLEDGE</h3>
                  <p className="text-[10px] opacity-75 font-mono">Everything you must know</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGuideModal(false)}
                className="w-8 h-8 rounded-full bg-slate-950/25 hover:bg-slate-950/50 flex items-center justify-center font-bold text-slate-950"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 font-mono text-xs text-slate-300">
              <div className="space-y-1">
                <h4 className="font-bold text-white flex items-center gap-1.5 uppercase tracking-wide text-[11px] text-amber-400">
                  <Award className="w-4 h-4" /> The Humble Beginning
                </h4>
                <p className="leading-relaxed">
                  You are a freshly spawned clump of poop 💩 trying to make it in a dangerous, clean world. Germs, flying insects, and the dreaded soap patrols have declared war on you!
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-white flex items-center gap-1.5 uppercase tracking-wide text-[11px] text-amber-400">
                  <Zap className="w-4 h-4" /> The Power of Porcelain
                </h4>
                <p className="leading-relaxed">
                  Every coin you gather around the map allows you to unlock better and cleaner bathroom machinery in the shop. Play them to flush: every time you play a toilet, <span className="text-red-400 font-bold">every enemy loses exactly 10 HP</span>!
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-white flex items-center gap-1.5 uppercase tracking-wide text-[11px] text-amber-400">
                  <Heart className="w-4 h-4" /> Roguelate Persistence
                </h4>
                <p className="leading-relaxed">
                  Do not worry if a soap bars wipes your HP to zero. You keep all your unlocked potties and accumulated bank coins for the next run, allowing you to gradually work your way up to the legendary Cyber-Bidet and Cosmic Gravity Toilets!
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-white flex items-center gap-1.5 uppercase tracking-wide text-[11px] text-amber-400">
                  <span>🍉</span> Wild Healing Fruits
                </h4>
                <p className="leading-relaxed">
                  Every second there is a <span className="text-emerald-400 font-bold">0.1% chance</span> that a rare healing fruit spawns on the map! Snatch them up to recover massive HP: <strong>🍎 (+15)</strong>, <strong>🍌 (+25)</strong>, <strong>🍓 (+35)</strong>, <strong>🍉 (+50)</strong>, or <strong>🍍 (+75)</strong>!
                </p>
              </div>

              <div className="space-y-1 border-t border-slate-800 pt-3">
                <h4 className="font-bold text-rose-400 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                  <span>💀</span> Elite Germs & Devastating Abilities
                </h4>
                <p className="leading-relaxed text-[11px] text-slate-300">
                  Beware during late game waves! High-tier germs with unique active abilities initiate:
                </p>
                <div className="space-y-1.5 text-[11px] text-slate-300 pl-2">
                  <div className="flex gap-1.5"><span className="text-amber-400">🧹</span> <span><strong>Brush Berserker (75 HP):</strong> Halts to charge, then unleashes a highly explosive, heat-guided speed dash directly at you!</span></div>
                  <div className="flex gap-1.5"><span className="text-emerald-400">🧴</span> <span><strong>Bleach Bomber (100 HP):</strong> Splotches radioactive green chlorine puddles that deal rapid continuous corrosive tick damage on contact.</span></div>
                  <div className="flex gap-1.5"><span className="text-purple-400">🪠</span> <span><strong>Plunger Overlord (200 HP):</strong> An armored mini-boss blocking 30% of flush damage and casting a gravity beam pulling Poop Hero in!</span></div>
                </div>
              </div>

              <button 
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all font-mono font-bold tracking-wider mt-2 border border-slate-755"
              >
                GOT IT! LET ME FLUSH 🚽
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Humble outer margin footer */}
      <footer className="border-t border-slate-900 bg-slate-950/40 py-6 text-center text-xs font-mono text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>Play with WASD/Arrows & Space | Mobile controls enabled on touch screens.</p>
          <p className="flex items-center gap-1 text-[11px]">
            Crafted with pride <span className="text-red-500 text-sm">♥</span> in your browser.
          </p>
        </div>
      </footer>

    </div>
  );
}
