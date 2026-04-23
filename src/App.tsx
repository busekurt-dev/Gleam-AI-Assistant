import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Search, ShoppingBag, TrendingUp, Info, ArrowRight, Loader2, RefreshCcw, UserCircle, X, CheckCircle2, Star, Trash2, Plus, Minus, ShoppingCart, Settings, LogOut } from 'lucide-react';
import { getSmartRecommendations, ComparisonResult, UserProfile } from './services/aiService';
import productsData from './products.json';

// Type for product from JSON
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  specs: Record<string, string>;
  description: string;
  freshness: number;
  marketPrices?: {
    mediamarkt?: { price: number };
    vatan?: { price: number };
    teknosa?: { price: number };
  };
}

interface CartItem extends Product {
  quantity: number;
}

interface Order {
  id: string;
  items: CartItem[];
  total: number;
  date: string;
  status: 'hazırlanıyor' | 'yolda' | 'teslim edildi';
}

const products = productsData as Product[];

export default function App() {
  const [onboardingStep, setOnboardingStep] = useState<'register' | 'consent' | 'app'>('register');
  const [userData, setUserData] = useState({ name: '', surname: '', phone: '' });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutData, setCheckoutData] = useState({ cardNumber: '', cardHolder: '', expiry: '', cvv: '' });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewedProducts, setViewedProducts] = useState<Product[]>([]);
  const [shownProductIds, setShownProductIds] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const loadingMessages = [
    "Teknosa stokları taranıyor...",
    "MediaMarkt fiyatları karşılaştırılıyor...",
    "Vatan Bilgisayar kampanyaları kontrol ediliyor...",
    "Gleam yapay zekası senin için en iyisini seçiyor...",
    "Teknik özellikler analiz ediliyor...",
    "Kullanıcı yorumları filtreleniyor..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setLoadingMessageIndex(0);
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const allTags = [
      "Oyun Laptopu", "Amiral Gemisi Telefon", "Akıllı Ev", "4K Monitör", 
      "Giyilebilir Teknoloji", "Robot Süpürge", "Kablosuz Kulaklık", 
      "Oyun Konsolu", "Tablet", "Akıllı Saat", "Dönüştürülebilir Laptop", 
      "Bluetooth Hoparlör", "E-Kitap Okuyucu", "Oyuncu Klavyesi"
    ];
    const shuffled = [...allTags].sort(() => 0.5 - Math.random()).slice(0, 5);
    setSuggestedTags(shuffled);
  }, []);

  // Default User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>({
    likedCategories: ["Laptop", "Akıllı Telefon", "Giyilebilir Teknoloji"],
    pastPurchases: [],
    preferredBrands: ["Apple", "Samsung", "Sony"],
    budgetSensitivity: 'Orta'
  });

  // Persistence logic
  const getUserKey = () => {
    return `gleam_user_${userData.name.toLowerCase()}_${userData.surname.toLowerCase()}_${userData.phone.replace(/\s/g, '')}`;
  };

  const handleFinishOnboarding = () => {
    setOnboardingStep('app');
    const key = getUserKey();
    const savedData = localStorage.getItem(key);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.cart) setCart(parsed.cart);
        if (parsed.orders) setOrders(parsed.orders);
        if (parsed.viewedProducts) setViewedProducts(parsed.viewedProducts);
        if (parsed.shownProductIds) setShownProductIds(parsed.shownProductIds);
        if (parsed.userProfile) setUserProfile(parsed.userProfile);
      } catch (e) {
        console.error("Failed to load user data", e);
      }
    }
  };

  // Auto-save data on changes
  useEffect(() => {
    if (onboardingStep === 'app') {
      const key = getUserKey();
      const dataToSave = {
        cart,
        orders,
        viewedProducts,
        shownProductIds,
        userProfile
      };
      localStorage.setItem(key, JSON.stringify(dataToSave));
    }
  }, [cart, orders, viewedProducts, shownProductIds, userProfile, onboardingStep]);

  // Auto-scroll to results when search is complete
  useEffect(() => {
    if (result && !loading) {
      const timer = setTimeout(() => {
        // Target the grid to skip the analysis text and see product details immediately
        const element = document.getElementById('recommendations-grid');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [result, loading]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (userData.name && userData.surname && userData.phone) {
      setOnboardingStep('consent');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSmartRecommendations(searchTerm, userProfile);
      
      if (!data || !data.recommendations || data.recommendations.length === 0) {
        throw new Error("Pazar taraması sonucunda uygun ürün bulunamadı. Lütfen farklı bir arama yapın.");
      }

      // Deduplicate recommendations by ID just in case AI returns duplicates
      const uniqueRecs = data.recommendations.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      setResult({ ...data, recommendations: uniqueRecs });
      setShownProductIds(uniqueRecs.map(r => r.id));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = (term: string) => {
    setQuery(term);
    setShowProfile(false);
    performSearch(term);
  };

  const addBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    if (userProfile.preferredBrands.includes(newBrandName.trim())) {
      setNewBrandName('');
      setShowAddBrand(false);
      return;
    }
    setUserProfile(prev => ({
      ...prev,
      preferredBrands: [...prev.preferredBrands, newBrandName.trim()]
    }));
    setNewBrandName('');
    setShowAddBrand(false);
  };

  const removeBrand = (brandName: string) => {
    setUserProfile(prev => ({
      ...prev,
      preferredBrands: prev.preferredBrands.filter(b => b !== brandName)
    }));
  };

  const openInspection = (productId: string) => {
    // Check static catalog first
    let product = products.find(p => p.id === productId);
    
    // Check viewed products (they have full data)
    if (!product) {
      product = viewedProducts.find(p => p.id === productId);
    }

    if (!product && result) {
      // Check last AI results (for web-sourced products)
      const aiProduct = result.recommendations.find(r => r.id === productId);
      if (aiProduct) {
        product = {
          id: aiProduct.id,
          name: aiProduct.productName,
          category: aiProduct.category || 'Teknoloji',
          price: aiProduct.price || 0,
          specs: (aiProduct.specs && Object.keys(aiProduct.specs).length > 0) 
            ? aiProduct.specs 
            : { "Temel Özellik": aiProduct.technicalHighlight || "Bilgi Araştırılıyor..." },
          description: aiProduct.description || aiProduct.reasoning,
          freshness: 100,
          marketPrices: aiProduct.marketPrices
        };
      }
    }

    if (product) {
      setSelectedProduct(product);
      // Add to viewed products (no duplicates)
      setViewedProducts(prev => {
        const exists = prev.find(p => p.id === productId);
        if (exists) return prev;
        return [product!, ...prev].slice(0, 4); // Keep last 4
      });
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    // Optional: show mini success feedback
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleRescan = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    try {
      const data = await getSmartRecommendations(query, userProfile, shownProductIds);
      setResult(data);
      setShownProductIds(prev => [...prev, ...data.recommendations.map(r => r.id)]);
      window.scrollTo({ top: 400, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetToHome = () => {
    setResult(null);
    setQuery('');
    setShownProductIds([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const maskPhone = (phone: string) => {
    if (phone.length < 10) return phone;
    const clean = phone.replace(/\s/g, '');
    return `${clean.substring(0, 4)}*****${clean.substring(clean.length - 2)}`;
  };

  const formatPhone = (val: string) => {
    const clean = val.replace(/\D/g, '');
    let formatted = clean;
    if (clean.length > 4) {
      formatted = `${clean.substring(0, 4)} ${clean.substring(4)}`;
    }
    if (clean.length > 7) {
      formatted = `${clean.substring(0, 4)} ${clean.substring(4, 7)} ${clean.substring(7)}`;
    }
    if (clean.length > 9) {
      formatted = `${clean.substring(0, 4)} ${clean.substring(4, 7)} ${clean.substring(7, 9)} ${clean.substring(9, 11)}`;
    }
    return formatted.trim();
  };

  const handleLogout = () => {
    setLogoutMessage("Oturumdan başarıyla çıkış yapılmıştır.");
    setShowSettings(false);
    setTimeout(() => {
      setLogoutMessage(null);
      handleReset();
    }, 2000);
  };

  const handleReset = () => {
    setOnboardingStep('register');
    setUserData({ name: '', surname: '', phone: '' });
    setQuery('');
    setResult(null);
    setCart([]);
    setOrders([]);
    setViewedProducts([]);
    setShownProductIds([]);
    setShowSettings(false);
    setShowProfile(false);
    setShowCart(false);
    setShowCheckout(false);
    setPaymentSuccess(false);
    setCheckoutData({ cardNumber: '', cardHolder: '', expiry: '', cvv: '' });
  };

  const formatCardNumber = (val: string) => {
    const clean = val.replace(/\D/g, '').substring(0, 16);
    return clean.match(/.{1,4}/g)?.join(' ') || clean;
  };

  const formatExpiry = (val: string) => {
    const clean = val.replace(/\D/g, '').substring(0, 4);
    if (clean.length > 2) return `${clean.substring(0, 2)}/${clean.substring(2)}`;
    return clean;
  };

  const handleCancelOrder = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setCancelingOrderId(null);
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingPayment(true);
    setTimeout(() => {
      const newOrder: Order = {
        id: Math.random().toString(36).substring(7).toUpperCase(),
        items: [...cart],
        total: cartTotal,
        date: new Date().toLocaleDateString('tr-TR'),
        status: 'hazırlanıyor'
      };
      setOrders(prev => [newOrder, ...prev]);
      
      // Update Purchase History (Satın Alma Geçmişi) after order is placed
      const newPurchasedItems = cart.map(item => item.name);
      setUserProfile(prev => ({
        ...prev,
        pastPurchases: Array.from(new Set([...prev.pastPurchases, ...newPurchasedItems]))
      }));

      setIsProcessingPayment(false);
      setPaymentSuccess(true);
      setCart([]);
    }, 2000);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (onboardingStep === 'register') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-navy relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-turquoise rounded-full blur-[120px]" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-turquoise rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass-panel p-10 rounded-3xl relative z-10"
        >
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-turquoise/10 rounded-2xl mb-4">
              <UserCircle className="w-12 h-12 text-turquoise" />
            </div>
            <h2 className="text-3xl font-black mb-2 italic">GLEAM</h2>
            <p className="text-slate-400">Akıllı alışveriş deneyimine hoş geldiniz. Lütfen bilgilerinizi girin.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="text-[10px] uppercase text-slate-500 font-bold mb-2 block tracking-widest">İsim</label>
              <input 
                required
                type="text" 
                value={userData.name}
                onChange={(e) => setUserData({...userData, name: e.target.value})}
                placeholder="Örn: Ahmet"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 focus:outline-none focus:border-turquoise/50 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 font-bold mb-2 block tracking-widest">Soyisim</label>
              <input 
                required
                type="text" 
                value={userData.surname}
                onChange={(e) => setUserData({...userData, surname: e.target.value})}
                placeholder="Örn: Yılmaz"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 focus:outline-none focus:border-turquoise/50 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 font-bold mb-2 block tracking-widest">Telefon Numarası</label>
              <input 
                required
                type="tel" 
                value={userData.phone}
                onChange={(e) => setUserData({...userData, phone: formatPhone(e.target.value)})}
                placeholder="05XX XXX XX XX"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 focus:outline-none focus:border-turquoise/50 transition-all font-mono"
              />
            </div>
            
            <button 
              type="submit"
              className="w-full bg-turquoise text-navy font-black py-5 rounded-2xl hover:bg-turquoise/80 transition-all flex items-center justify-center gap-2 group mt-8"
            >
              Devam Et
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (onboardingStep === 'consent') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-navy relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-turquoise rounded-full blur-[120px]" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-turquoise rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-panel p-8 rounded-2xl relative z-10"
        >
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-turquoise/20 rounded-xl">
              <ShieldCheck className="w-10 h-10 text-turquoise" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-4">Veri Güvenliği ve KVKK</h2>
          <p className="text-slate-400 text-center mb-8 text-sm leading-relaxed">
            Gleam asistanı, {userData.name} {userData.surname} olarak size en iyi önerileri sunmak için aramalarınızı analiz eder. Devam ederek Aydınlatma Metni'ni okuduğunuzu ve verilerinizin işlenmesine onay verdiğinizi kabul etmiş olursunuz.
          </p>
          
          <button 
            onClick={handleFinishOnboarding}
            className="w-full bg-turquoise text-navy font-bold py-4 rounded-xl hover:bg-turquoise/80 transition-all flex items-center justify-center gap-2 group"
          >
            Anladım ve Onaylıyorum
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy text-white pb-20">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 glass-panel py-4 px-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button onClick={resetToHome} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-turquoise flex items-center justify-center shadow-[0_0_10px_rgba(57,255,20,0.4)]">
              <ShoppingBag className="w-5 h-5 text-navy" />
            </div>
            <span className="text-xl font-bold tracking-tight italic">GLEAM</span>
          </button>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowProfile(true)}
              className="md:hidden p-2 text-slate-400 hover:text-turquoise transition-colors"
              aria-label="Profilim"
            >
              <UserCircle className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setShowCart(true)}
              className="md:hidden p-2 text-slate-400 hover:text-turquoise transition-colors relative"
              aria-label="Sepetim"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 bg-turquoise text-navy text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-[0_0_5px_rgba(57,255,20,0.5)]">
                  {cartCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="md:hidden p-2 text-slate-400 hover:text-turquoise transition-colors"
              aria-label="Ayarlar"
            >
              <Settings className="w-6 h-6" />
            </button>

            <div className="hidden md:flex gap-6 text-sm font-medium text-slate-400">
              <button 
                onClick={() => setShowProfile(true)}
                className="hover:text-turquoise transition-colors flex items-center gap-2"
              >
                <UserCircle className="w-4 h-4" />
                Profilim
              </button>
              <button 
                onClick={() => setShowCart(true)}
                className="hover:text-turquoise transition-colors flex items-center gap-2 relative"
              >
                <ShoppingCart className="w-4 h-4" />
                Sepetim
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-4 bg-turquoise text-navy text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-[0_0_5px_rgba(57,255,20,0.5)]">
                    {cartCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="hover:text-turquoise transition-colors flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Ayarlar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Logout Success Message */}
      <AnimatePresence>
        {logoutMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-turquoise text-navy rounded-full font-bold shadow-lg flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            {logoutMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shopping Cart Sidebar */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 h-full w-full max-w-sm glass-panel z-[101] p-8 shadow-2xl border-l border-white/10 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-turquoise" />
                  Alışveriş Sepeti
                </h2>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                    <ShoppingBag className="w-16 h-16 opacity-20" />
                    <p>Sepetiniz şu an boş.</p>
                    <button 
                      onClick={() => setShowCart(false)}
                      className="text-turquoise text-sm font-bold hover:underline"
                    >
                      Alışverişe Başla
                    </button>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="glass-panel p-4 rounded-xl flex gap-4 items-center">
                      <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                         <ShoppingBag className="w-6 h-6 text-turquoise/40" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="text-sm font-bold truncate">{item.name}</div>
                        <div className="text-xs text-turquoise">{item.price.toLocaleString('tr-TR')} TL</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2 bg-navy/50 rounded-lg p-1 border border-white/5">
                           <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-turquoise"><Minus className="w-3 h-3" /></button>
                           <span className="text-xs w-4 text-center">{item.quantity}</span>
                           <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-turquoise"><Plus className="w-3 h-3" /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-slate-400">Toplam</span>
                    <span className="text-2xl font-black text-turquoise">{cartTotal.toLocaleString('tr-TR')} TL</span>
                  </div>
                  <button 
                    onClick={() => {
                      setShowCart(false);
                      setShowCheckout(true);
                      setPaymentSuccess(false);
                    }}
                    className="w-full bg-turquoise text-navy font-bold py-4 rounded-xl hover:bg-turquoise/80 transition-all shadow-[0_4px_15px_rgba(57,255,20,0.3)]"
                  >
                    Ödemeye Geç
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* User Profile Sidebar/Modal */}
      <AnimatePresence>
        {showProfile && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfile(false)}
              className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 h-full w-full max-w-sm glass-panel z-[101] p-8 shadow-2xl border-l border-white/10 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8 shrink-0">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <UserCircle className="w-6 h-6 text-turquoise" />
                  Kullanıcı Profili
                </h2>
                <button onClick={() => setShowProfile(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto pr-2 pb-6 flex-grow scrollbar-thin scrollbar-thumb-white/10">
                {/* User Info Section */}
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-turquoise/20 flex items-center justify-center text-turquoise font-bold uppercase">
                      {userData.name.charAt(0)}{userData.surname.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold uppercase tracking-tight">{userData.name} {userData.surname}</div>
                      <div className="text-[10px] text-slate-500 font-mono italic">{maskPhone(userData.phone)}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-slate-500 font-bold mb-2 block tracking-widest">Sevilen Kategoriler</label>
                  <div className="flex flex-wrap gap-2">
                    {userProfile.likedCategories.map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => handleQuickSearch(cat)}
                        className="px-3 py-1 bg-turquoise/10 text-turquoise text-xs rounded-full border border-turquoise/20 hover:bg-turquoise/20 transition-all text-left"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                   <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] uppercase text-slate-500 font-bold block">Favori Markalar</label>
                    <button 
                      onClick={() => setShowAddBrand(!showAddBrand)}
                      className="p-1 hover:bg-white/10 rounded-lg text-turquoise transition-all"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                   </div>

                   {showAddBrand && (
                     <form onSubmit={addBrand} className="flex gap-2 mb-3">
                        <input 
                          autoFocus
                          type="text"
                          value={newBrandName}
                          onChange={(e) => setNewBrandName(e.target.value)}
                          placeholder="Marka adı..."
                          className="flex-grow bg-white/5 border border-white/10 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-turquoise/50"
                        />
                        <button type="submit" className="bg-turquoise text-navy px-2 rounded-lg text-xs font-bold">Ekle</button>
                     </form>
                   )}

                   <div className="flex flex-wrap gap-2">
                    {userProfile.preferredBrands.map(brand => (
                      <div key={brand} className="group flex items-center bg-white/5 rounded-full border border-white/10 pr-1 hover:border-turquoise/20 transition-all">
                        <button 
                          onClick={() => handleQuickSearch(brand)}
                          className="px-3 py-1 text-slate-300 text-xs hover:text-turquoise transition-colors"
                        >
                          {brand}
                        </button>
                        <button 
                          onClick={() => removeBrand(brand)}
                          className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                   <label className="text-[10px] uppercase text-slate-500 font-bold mb-2 block">Satın Alma Geçmişi</label>
                   <div className="space-y-2">
                    {userProfile.pastPurchases.map(item => (
                      <div key={item} className="flex items-center gap-2 text-sm text-slate-400">
                        <CheckCircle2 className="w-4 h-4 text-turquoise" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                   <label className="text-[10px] uppercase text-slate-500 font-bold mb-4 block tracking-widest">Son Siparişlerim</label>
                   {orders.length === 0 ? (
                     <div className="text-xs text-slate-500 italic">Henüz bir siparişiniz bulunmuyor.</div>
                   ) : (
                     <div className="space-y-4">
                       {orders.map(order => (
                         <div key={order.id} className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3 relative overflow-hidden group/order">
                            <AnimatePresence>
                              {cancelingOrderId === order.id && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                  className="absolute inset-0 bg-navy flex flex-col items-center justify-center p-4 rounded-3xl z-40 border border-white/10 shadow-2xl"
                                >
                                  <motion.div 
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.05 }}
                                    className="flex flex-col items-center justify-center w-full"
                                  >
                                    <div className="w-10 h-10 bg-red-500/30 rounded-full flex items-center justify-center mb-3 shadow-xl shadow-red-500/10">
                                      <Trash2 className="w-5 h-5 text-white" />
                                    </div>
                                    <h4 className="text-white/80 text-[9px] font-bold mb-1 uppercase tracking-[0.2em] font-sans">İptal İşlemi</h4>
                                    <p className="text-[10px] text-slate-300 mb-4 leading-normal px-2 text-center">
                                      Siparişinizi iptal etmek istediğinize emin misiniz?
                                    </p>
                                    
                                    <div className="grid grid-cols-2 gap-2 w-full max-w-[170px]">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setCancelingOrderId(null); }}
                                        className="bg-transparent border border-slate-500/40 text-slate-300 text-[9px] font-bold py-2 rounded-xl hover:bg-white/5 transition-all flex items-center justify-center"
                                      >
                                        VAZGEÇ
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.id); }}
                                        className="bg-red-400/90 text-white text-[9px] font-black py-2 rounded-xl hover:bg-red-500/90 transition-all shadow-xl shadow-red-500/20 flex items-center justify-center"
                                      >
                                        İPTAL ET
                                      </button>
                                    </div>
                                  </motion.div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                           <div className="flex justify-between items-center text-[10px] text-slate-500">
                             <span>#{order.id}</span>
                             <span>{order.date}</span>
                           </div>
                           <div className="space-y-4 pt-1">
                             {order.items.map((item, idx) => (
                               <div key={idx} className="flex justify-between items-center group/item">
                                  <button 
                                    onClick={() => openInspection(item.id)}
                                    className="flex flex-col gap-0.5 min-w-0 flex-grow text-left hover:bg-white/5 p-2 -m-2 rounded-xl transition-colors cursor-pointer group"
                                  >
                                    <div className="text-xs font-bold text-white leading-tight truncate group-hover/item:text-turquoise transition-colors flex items-center gap-2">
                                      {item.name}
                                      <Info className="w-3 h-3 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="text-[10px] text-turquoise/80 font-mono">{item.price.toLocaleString('tr-TR')} TL {item.quantity > 1 && `(x${item.quantity})`}</div>
                                  </button>
                                  <button 
                                    onClick={() => setCancelingOrderId(order.id)}
                                    className="p-2 text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover/order:opacity-100"
                                    title="Siparişi İptal Et"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                               </div>
                             ))}
                           </div>
                           <div className="pt-3 border-t border-white/5">
                             <div className="flex justify-between items-center">
                               <div className="text-[10px] font-bold flex items-center gap-2">
                                 {order.status === 'hazırlanıyor' && (
                                   <span className="flex items-center gap-1.5 text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                                     <div className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
                                     Hazırlanıyor
                                   </span>
                                 )}
                                 {order.status === 'yolda' && (
                                   <span className="flex items-center gap-1.5 text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                                     <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                                     Yolda 🛵
                                   </span>
                                 )}
                                 {order.status === 'teslim edildi' && (
                                   <span className="flex items-center gap-1.5 text-turquoise bg-turquoise/10 px-2 py-0.5 rounded-full">
                                     <CheckCircle2 className="w-3 h-3" />
                                     Teslim Edildi
                                   </span>
                                 )}
                               </div>
                               <div className="text-[10px] font-mono text-white/40">
                                 Toplam: {order.total.toLocaleString('tr-TR')} TL
                               </div>
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 shrink-0">
                 <p className="text-[10px] text-slate-500 text-center animate-pulse">Profil verileri önerilerinizi %100 kişiselleştirmek için kullanılır.</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-navy/90 backdrop-blur-md z-[200]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 m-auto w-full max-w-2xl h-fit max-h-[90vh] glass-panel z-[201] p-8 rounded-3xl overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                   <span className="text-turquoise text-[10px] uppercase tracking-widest font-bold mb-2 block">{selectedProduct.category}</span>
                   <h2 className="text-3xl font-black">{selectedProduct.name}</h2>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-6 col-span-2">
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Teknik Özellikler</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                       {Object.entries(selectedProduct.specs).map(([key, val]) => (
                         <div key={key} className="flex justify-between text-sm py-2 border-b border-white/5">
                            <span className="text-slate-400 capitalize">{key.replace('_', ' ')}:</span>
                            <span className="font-medium text-white">{val}</span>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl border-turquoise/20">
                    <div className="w-full">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1 text-center md:text-left">Güncel Fiyat</h3>
                    <div className="text-3xl font-black text-turquoise text-center md:text-left">
                      {(selectedProduct.price || 0).toLocaleString('tr-TR')} TL
                    </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 mb-8">
                <h3 className="text-sm font-bold text-turquoise uppercase tracking-wider mb-2 flex items-center gap-2">
                   <Star className="w-4 h-4 fill-turquoise" />
                   Neden Bu Ürün?
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed leading-relaxed italic">
                  {selectedProduct.description}
                </p>
              </div>

              <div className="space-y-6">
                <button 
                  onClick={() => {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                    setShowCart(true);
                  }}
                  className="w-full bg-turquoise text-navy font-bold py-5 rounded-xl hover:bg-turquoise/80 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(57,255,20,0.3)]"
                >
                  Sepete Ekle <ArrowRight className="w-5 h-5" />
                </button>

                {selectedProduct.marketPrices && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {selectedProduct.marketPrices.mediamarkt && typeof selectedProduct.marketPrices.mediamarkt.price === 'number' && (
                      <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center group">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">MediaMarkt</div>
                        <div className="text-sm font-black text-white">{selectedProduct.marketPrices.mediamarkt.price.toLocaleString('tr-TR')} TL</div>
                      </div>
                    )}
                    {selectedProduct.marketPrices.vatan && typeof selectedProduct.marketPrices.vatan.price === 'number' && (
                      <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center group">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Vatan Bilgisayar</div>
                        <div className="text-sm font-black text-white">{selectedProduct.marketPrices.vatan.price.toLocaleString('tr-TR')} TL</div>
                      </div>
                    )}
                    {selectedProduct.marketPrices.teknosa && typeof selectedProduct.marketPrices.teknosa.price === 'number' && (
                      <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center group">
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Teknosa</div>
                        <div className="text-sm font-black text-white">{selectedProduct.marketPrices.teknosa.price.toLocaleString('tr-TR')} TL</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="pt-32 px-6 max-w-7xl mx-auto">
        {/* Intro */}
        {!result && (
          <section className="mb-12 text-center">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-black mb-6 leading-tight"
            >
              Seçim Paradoksunu <br/> <span className="text-turquoise">Zeka İle Çözün</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 max-w-2xl mx-auto text-lg"
            >
              Teknosa, MediaMarkt ve Vatan gibi devlerin güncel stoklarını Gleam zekasıyla tarayın. Telefonlardan laptoplara, ihtiyacınız olan her teknolojik ürünü saniyeler içinde bulun.
            </motion.p>
          </section>
        )}

        {/* Search Input */}
        <div className="max-w-3xl mx-auto mb-16 relative">
          <form onSubmit={handleSearch}>
            <div className="relative group overflow-hidden rounded-2xl">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Örn: 40.000 TL altı en iyi oyun laptopu hangisi?"
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 md:py-6 pl-12 md:pl-14 pr-28 md:pr-40 focus:outline-none focus:border-turquoise/50 focus:ring-1 focus:ring-turquoise/20 transition-all text-sm md:text-lg group-hover:bg-slate-900/80 placeholder:opacity-0 md:placeholder:opacity-100"
              />
              
              {/* Mobile Marquee Placeholder */}
              {!query && (
                <div className="absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none md:hidden w-[calc(100%-140px)] overflow-hidden text-slate-500 marquee-container">
                  <span className="marquee-content whitespace-nowrap text-sm">
                    Örn: 40.000 TL altı en iyi oyun laptopu hangisi? &nbsp;&nbsp;&nbsp;&nbsp; Gleam ile pazarın derinliklerini keşfedin... &nbsp;&nbsp;&nbsp;&nbsp; Teknosa, Vatan, MediaMarkt fiyatlarını saniyeler içinde karşılaştırın.
                  </span>
                </div>
              )}

              <Search className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 md:w-6 md:h-6" />
              <button 
                disabled={loading}
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-turquoise text-navy font-bold px-4 py-2 md:px-6 md:py-3 rounded-xl hover:bg-turquoise/80 disabled:opacity-50 transition-all flex items-center gap-1.5 text-xs md:text-base whitespace-nowrap"
              >
                {loading ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : (
                  <>
                    <span className="hidden sm:inline">Pazarı</span>Tara
                  </>
                )}
              </button>
            </div>
          </form>
          {/* Tags */}
          <div className="flex gap-3 mt-4 overflow-x-auto pb-2 scrollbar-none">
             {suggestedTags.map(tag => (
               <button 
                key={tag}
                onClick={() => {
                  const q = `Bana ${tag.toLowerCase()} özelliği olan ürünler öner.`;
                  setQuery(q);
                  performSearch(q);
                }}
                className="whitespace-nowrap px-4 py-1.5 rounded-full border border-white/5 bg-white/5 text-xs text-slate-400 hover:text-turquoise hover:border-turquoise/20 transition-all"
               >
                 #{tag}
               </button>
             ))}
          </div>
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto mb-12 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center"
            >
              <div className="text-red-400 font-bold mb-2">Arama Sırasında Bir Hata Oluştu</div>
              <div className="text-sm text-red-300/80 mb-4">{error}</div>
              <button 
                onClick={() => performSearch(query)}
                className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg transition-all"
              >
                Tekrar Dene
              </button>
            </motion.div>
          )}

          {!result && viewedProducts.length > 0 && !loading && !error && (
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="max-w-4xl mx-auto mb-20"
             >
                <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4 text-turquoise" />
                  Önceden Gezdikleriniz
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {viewedProducts.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => openInspection(p.id)}
                      className="glass-panel p-4 rounded-xl text-left hover:border-turquoise/30 transition-all group"
                    >
                      <div className="text-[10px] text-turquoise font-bold uppercase mb-1 opacity-60">{p.category}</div>
                      <div className="text-xs font-bold truncate group-hover:text-turquoise transition-colors">{p.name}</div>
                      <div className="text-[10px] text-slate-500 mt-2">{p.price.toLocaleString('tr-TR')} TL</div>
                    </button>
                  ))}
                </div>
             </motion.div>
          )}

          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-t-2 border-turquoise animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="w-8 h-8 text-turquoise animate-pulse" />
                </div>
              </div>
              <div className="mt-8 text-center px-6 min-w-[320px]">
                <p className="text-xl font-medium text-white mb-2 italic">Gleam Sizin İçin Tarıyor...</p>
                <div className="h-6 overflow-hidden">
                  <motion.p 
                    key={loadingMessageIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="text-slate-400 text-sm font-light tracking-wide"
                  >
                    {loadingMessages[loadingMessageIndex]}
                  </motion.p>
                </div>
                
                <div className="mt-8 flex justify-center gap-1.5">
                  {loadingMessages.map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-1 rounded-full transition-all duration-700 ${
                        i === loadingMessageIndex ? 'bg-turquoise w-8 shadow-[0_0_10px_rgba(45,212,191,0.5)]' : 'bg-slate-800 w-3'
                      }`} 
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {result && !loading && (
            <motion.div
              id="results-view"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12"
            >
              <div className="glass-panel p-6 rounded-2xl flex items-start gap-4">
                <div className="p-3 bg-turquoise/10 rounded-lg shrink-0">
                  <TrendingUp className="w-6 h-6 text-turquoise" />
                </div>
                <div>
                  <h3 className="font-bold text-turquoise mb-1">Gleam Market Analizi</h3>
                  <p className="text-slate-300 leading-relaxed text-sm">
                    {result.analysis}
                  </p>
                </div>
              </div>

              <div id="recommendations-grid" className="grid md:grid-cols-3 gap-6">
                {result.recommendations.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="glass-panel p-6 rounded-2xl flex flex-col group relative overflow-hidden"
                  >
                    {/* Top Stats */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="text-xs font-mono text-slate-500"></div>
                      <div className="flex flex-col items-end">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Güven Puanı</div>
                        <div className="text-2xl font-black text-turquoise flex items-baseline">
                          <span className="text-xs mr-0.5">%</span>{Math.round(item.confidenceScore > 10 ? item.confidenceScore : item.confidenceScore * 10)}
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold mb-3 group-hover:text-turquoise transition-colors">{item.productName}</h3>
                    
                    <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/5">
                       <div className="text-[10px] uppercase text-turquoise mb-1 font-bold">Kişiselleştirilmiş Eşleşme</div>
                       <div className="text-sm font-medium text-slate-300 italic">"{item.personalizedReasoning}"</div>
                    </div>

                    <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/5">
                       <div className="text-[10px] uppercase text-slate-500 mb-1">Pazar Analizi</div>
                       <div className="text-xs text-slate-400">{item.reasoning}</div>
                    </div>

                    <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/5">
                       <div className="text-[10px] uppercase text-slate-500 mb-1">Teknik Focus</div>
                       <div className="text-sm font-medium">{item.technicalHighlight}</div>
                    </div>

                    <div className="pt-6 border-t border-white/5 flex items-center justify-between mt-auto">
                       <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-turquoise" />
                          <span className="text-xs text-slate-500">F/P: {item.pricePerformanceScore}/10</span>
                       </div>
                       <button 
                        onClick={() => openInspection(item.id)}
                        className="text-turquoise text-sm font-bold flex items-center gap-1 hover:translate-x-1 transition-transform"
                       >
                          İncele <ArrowRight className="w-4 h-4" />
                       </button>
                    </div>

                    {/* Background number for design flair */}
                    <div className="absolute -bottom-6 -right-6 text-9xl font-black opacity-[0.03] select-none pointer-events-none italic">
                       {idx + 1}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-center mt-12 pb-10">
                <button 
                  onClick={handleRescan}
                  disabled={loading}
                  className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-turquoise/20 text-turquoise rounded-2xl hover:bg-turquoise hover:text-navy transition-all font-bold group disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />}
                  Yeniden Sorgula (Yeni Öneriler Getir)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Decoration */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 h-full w-full max-w-sm glass-panel z-[101] p-8 shadow-2xl border-l border-white/10"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-6 h-6 text-turquoise" />
                  Ayarlar
                </h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-red-500/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-400 transition-colors" />
                    <div className="text-left">
                      <div className="text-sm font-bold">Oturumu Kapat</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-tighter">Güvenli çıkış yap</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Checkout Transition/Success State */}
      <AnimatePresence>
        {showCheckout && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-navy/95 backdrop-blur-xl z-[300] overflow-y-auto px-4 py-8 md:p-8"
            >
              <div className="max-w-2xl w-full mx-auto min-h-full flex items-center justify-center">
                <div className="w-full">
                  {paymentSuccess ? (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center space-y-6"
                  >
                    <div className="w-24 h-24 bg-turquoise/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-turquoise/30">
                      <CheckCircle2 className="w-12 h-12 text-turquoise" />
                    </div>
                    <h2 className="text-4xl font-black italic">ÖDEME BAŞARILI!</h2>
                    <p className="text-slate-400 max-w-sm mx-auto">
                      Siparişiniz alındı ve Gleam uzmanları tarafından hazırlanmaya başlandı. Teknolojinin keyfini çıkarın!
                    </p>
                    <button 
                      onClick={() => setShowCheckout(false)}
                      className="bg-turquoise text-navy font-bold py-4 px-12 rounded-2xl hover:bg-turquoise/80 transition-all shadow-[0_0_20px_rgba(57,255,20,0.4)]"
                    >
                      Alışverişe Devam Et
                    </button>
                  </motion.div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-12">
                    {/* Payment Form */}
                    <div className="space-y-8">
                      <div className="flex items-center gap-3 mb-2">
                        <ShieldCheck className="w-6 h-6 text-turquoise" />
                        <h2 className="text-2xl font-bold">Güvenli Ödeme</h2>
                      </div>
                      
                      <form onSubmit={handlePayment} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Kart Üzerindeki İsim</label>
                          <input 
                            required
                            type="text"
                            value={checkoutData.cardHolder}
                            onChange={(e) => setCheckoutData({...checkoutData, cardHolder: e.target.value.toUpperCase()})}
                            placeholder="AHMET YILMAZ"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 focus:outline-none focus:border-turquoise/50 transition-all uppercase"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Kart Numarası</label>
                          <input 
                            required
                            type="text"
                            value={checkoutData.cardNumber}
                            onChange={(e) => setCheckoutData({...checkoutData, cardNumber: formatCardNumber(e.target.value)})}
                            placeholder="0000 0000 0000 0000"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 focus:outline-none focus:border-turquoise/50 transition-all font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Son Kullanma</label>
                            <input 
                              required
                              type="text"
                              value={checkoutData.expiry}
                              onChange={(e) => setCheckoutData({...checkoutData, expiry: formatExpiry(e.target.value)})}
                              placeholder="AA/YY"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 focus:outline-none focus:border-turquoise/50 transition-all font-mono"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">CVV</label>
                            <input 
                              required
                              type="text"
                              maxLength={3}
                              value={checkoutData.cvv}
                              onChange={(e) => setCheckoutData({...checkoutData, cvv: e.target.value.replace(/\D/g, '')})}
                              placeholder="123"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 focus:outline-none focus:border-turquoise/50 transition-all font-mono"
                            />
                          </div>
                        </div>

                        <button 
                          disabled={isProcessingPayment}
                          className="w-full bg-turquoise text-navy font-bold py-5 rounded-2xl hover:bg-turquoise/80 transition-all disabled:opacity-50 shadow-[0_4px_15px_rgba(57,255,20,0.3)] mt-6"
                        >
                          {isProcessingPayment ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Ödemeyi Onayla'}
                        </button>
                        
                        <button 
                          type="button"
                          onClick={() => setShowCheckout(false)}
                          className="w-full text-slate-500 text-sm hover:text-white transition-colors"
                        >
                          İptal Et
                        </button>
                      </form>
                    </div>

                    {/* Order Summary */}
                    <div className="glass-panel p-8 rounded-3xl border-turquoise/20 h-fit">
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-6">Sipariş Özeti</h3>
                      <div className="space-y-4 mb-8">
                         {cart.map(item => (
                           <div key={item.id} className="flex justify-between items-start gap-4">
                              <div className="text-sm">
                                <span className="font-bold text-white block">{item.name}</span>
                                <span className="text-xs text-slate-500">{item.quantity} Adet</span>
                              </div>
                              <div className="text-sm font-mono text-turquoise">
                                {(item.price * item.quantity).toLocaleString('tr-TR')} TL
                              </div>
                           </div>
                         ))}
                      </div>
                      <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                        <span className="font-bold text-slate-400">Genel Toplam</span>
                        <span className="text-2xl font-black text-turquoise">{cartTotal.toLocaleString('tr-TR')} TL</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      <footer className="mt-32 pt-12 pb-8 border-t border-white/5">
         <div className="max-w-7xl mx-auto px-6 flex justify-between items-center text-slate-600 text-[10px] uppercase tracking-[0.2em] font-bold">
            <div>© 2026 GLEAM AI SYSTEMS</div>
            <div>STATUS: ONLINE // RAG SYSTEM ACTIVE</div>
         </div>
      </footer>
    </div>
  );
}
