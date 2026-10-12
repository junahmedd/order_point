import React, { useState, useEffect } from 'react';
import PageLayout from './PageLayout';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { 
  Star, 
  MessageSquare, 
  Phone, 
  Calendar, 
  Filter, 
  Search, 
  AlertOctagon, 
  CheckCircle, 
  Send, 
  TrendingUp, 
  ThumbsUp, 
  ThumbsDown, 
  Sparkles, 
  Utensils, 
  Briefcase, 
  Smile, 
  X,
  Reply,
  ArrowRight,
  Inbox,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { CustomerFeedback, Order } from '../types';
import toast from 'react-hot-toast';

export default function FeedbackDashboard() {
  const [feedbackList, setFeedbackList] = useState<CustomerFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<CustomerFeedback | null>(null);
  
  // Interactive UI states
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<'All' | 'Positive' | 'Critical' | 'PendingReply'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  
  // Reply inputs
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});
  const [submittingReply, setSubmittingReply] = useState<{ [id: string]: boolean }>({});
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const activeUid = userId || auth.currentUser?.uid;
    if (!activeUid) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const feedbackPath = `restaurants/${activeUid}/feedback`;
    const feedbackRef = collection(db, feedbackPath);
    const q = query(feedbackRef, orderBy('feedbackDate', 'desc'));

    const unsub = onSnapshot(q, (snapshot) => {
      const fb: CustomerFeedback[] = [];
      snapshot.forEach((doc) => {
        fb.push(doc.data() as CustomerFeedback);
      });
      setFeedbackList(fb);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, feedbackPath);
      setLoading(false);
    });

    return unsub;
  }, [userId]);

  // Compute analytics
  const totalReviews = feedbackList.length;
  
  const averageOverall = totalReviews > 0
    ? parseFloat((feedbackList.reduce((sum, f) => sum + (f.overallRating || 0), 0) / totalReviews).toFixed(1))
    : 0;

  const averageFood = totalReviews > 0
    ? parseFloat((feedbackList.reduce((sum, f) => sum + (f.foodRating !== undefined ? f.foodRating : (f.foodQualityRating !== undefined ? f.foodQualityRating : 0)), 0) / totalReviews).toFixed(1))
    : 0;

  const averageService = totalReviews > 0
    ? parseFloat((feedbackList.reduce((sum, f) => sum + (f.serviceRating || 0), 0) / totalReviews).toFixed(1))
    : 0;

  const averageCleanliness = totalReviews > 0
    ? parseFloat((feedbackList.reduce((sum, f) => sum + (f.cleanlinessRating !== undefined ? f.cleanlinessRating : (f.ambienceRating !== undefined ? f.ambienceRating : 0)), 0) / totalReviews).toFixed(1))
    : 0;

  const positiveCount = feedbackList.filter(f => f.overallRating >= 4 || f.category === 'Positive').length;
  const criticalCount = feedbackList.filter(f => f.overallRating <= 3 || f.category === 'Complaint').length;
  const pendingReplyCount = feedbackList.filter(f => !f.managerReply && !f.adminReply && f.status !== 'Replied' && f.status !== 'Resolved').length;
  
  const positivePercentage = totalReviews > 0 
    ? Math.round((positiveCount / totalReviews) * 100) 
    : 0;

  // Handle reply submission
  const handleSaveReply = async (feedbackId: string, customText?: string) => {
    const text = (customText !== undefined ? customText : replyText[feedbackId])?.trim();
    if (!text) {
      toast.error("Please enter a reply message.");
      return;
    }

    try {
      setSubmittingReply(prev => ({ ...prev, [feedbackId]: true }));
      const activeUid = userId || localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
      
      const writePath = `restaurants/${activeUid}/feedback/${feedbackId}`;
      const feedbackDocRef = doc(db, writePath);
      await updateDoc(feedbackDocRef, {
        managerReply: text,
        adminReply: text,
        status: 'Replied',
        repliedAt: serverTimestamp()
      });

      toast.success("Reply saved successfully!");
      setReplyText(prev => ({ ...prev, [feedbackId]: '' }));
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `restaurants/${userId || localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant'}/feedback/${feedbackId}`);
      toast.error("Error submitting response.");
    } finally {
      setSubmittingReply(prev => ({ ...prev, [feedbackId]: false }));
    }
  };

  // Handle delete feedback
  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!window.confirm("Are you sure you want to delete this customer feedback record? This action is irreversible.")) {
      return;
    }

    try {
      const activeUid = userId || localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
      const deletePath = `restaurants/${activeUid}/feedback/${feedbackId}`;
      await deleteDoc(doc(db, deletePath));
      toast.success("Feedback record removed.");
    } catch (e: any) {
      handleFirestoreError(e, OperationType.DELETE, `restaurants/${userId || localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant'}/feedback/${feedbackId}`);
      toast.error("Error deleting feedback.");
    }
  };

  // Filter list
  const filteredFeedback = feedbackList.filter(f => {
    // Rating level filter
    if (selectedRatingFilter === 'Positive' && f.overallRating < 4 && f.category !== 'Positive') return false;
    if (selectedRatingFilter === 'Critical' && f.overallRating >= 4 && f.category !== 'Complaint') return false;
    if (selectedRatingFilter === 'PendingReply' && (f.managerReply || f.adminReply || f.status === 'Replied' || f.status === 'Resolved')) return false;

    // Search query match
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      const matchName = f.customerName?.toLowerCase().includes(queryLower);
      const matchPhone = f.customerPhone?.includes(queryLower);
      const matchInvoice = (f.invoiceNo || f.invoiceId)?.toLowerCase().includes(queryLower);
      const matchReview = (f.review || f.comments)?.toLowerCase().includes(queryLower);
      return matchName || matchPhone || matchInvoice || matchReview;
    }

    return true;
  });

  return (
    <PageLayout
      title="Feedback"
      subtitle="Monitor food quality, staff hospitality, and cleanliness reviews."
      actions={
        /* Live status check */
        <div className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Active Feedback Gateway</span>
        </div>
      }
    >


      {/* Critical complaints banner tracker */}
      {feedbackList.filter(f => f.overallRating <= 3 && f.status !== 'Resolved' && f.status !== 'Replied').length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 border border-rose-300">
              <AlertOctagon size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-900 uppercase tracking-wide">
                Urgent Attention Needed: {feedbackList.filter(f => f.overallRating <= 3 && f.status !== 'Resolved' && f.status !== 'Replied').length} Unresolved Complaints!
              </h4>
              <p className="text-xs text-rose-700 font-medium">
                Diners left overall ratings of 3 stars or less. Please reply immediately to resolve issues and protect your Google Review reputation.
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setSelectedRatingFilter('Critical');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap uppercase tracking-wider"
          >
            Filter Complaints
          </button>
        </div>
      )}



      {/* Search and Filters Drawer */}
      <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Left: Tab category buttons */}
        <div className="flex flex-wrap gap-1.5 border border-gray-150 p-1 rounded-xl bg-gray-50">
          <button
            onClick={() => setSelectedRatingFilter('All')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
              selectedRatingFilter === 'All'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            All Reviews ({totalReviews})
          </button>
          
          <button
            onClick={() => setSelectedRatingFilter('Positive')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1 ${
              selectedRatingFilter === 'Positive'
                ? 'bg-white text-emerald-600 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Positive ({positiveCount})
          </button>
          
          <button
            onClick={() => setSelectedRatingFilter('Critical')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1 ${
              selectedRatingFilter === 'Critical'
                ? 'bg-white text-rose-600 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Complaints ({criticalCount})
          </button>

          <button
            onClick={() => setSelectedRatingFilter('PendingReply')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1 ${
              selectedRatingFilter === 'PendingReply'
                ? 'bg-white text-amber-600 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Pending Reply ({pendingReplyCount})
          </button>
        </div>

        {/* Right: Search box */}
        <div className="relative max-w-sm w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice number, guest name, comments..."
            className="w-full h-10 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          />
          <Search className="absolute left-3 top-3 text-gray-400" size={14} />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          )}
        </div>

      </div>

      {/* Main Reviews List Panel */}
      <div className="space-y-4">
        {filteredFeedback.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-150 p-16 text-center space-y-4">
            <div className="w-14 h-14 bg-gray-50 border border-gray-150 rounded-full flex items-center justify-center mx-auto text-gray-400">
              <Inbox size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-gray-800">No matching feedback records</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                No customer ratings match the specified filters or search query terms. Try expanding your parameters.
              </p>
            </div>
          </div>
        ) : (
          filteredFeedback.map((feedback) => {
            const isCritical = feedback.overallRating <= 3 || feedback.category === 'Complaint';
            const fFoodRating = feedback.foodRating !== undefined ? feedback.foodRating : (feedback.foodQualityRating !== undefined ? feedback.foodQualityRating : 0);
            const fCleanlinessRating = feedback.cleanlinessRating !== undefined ? feedback.cleanlinessRating : (feedback.ambienceRating !== undefined ? feedback.ambienceRating : 0);
            const fComments = feedback.comments || feedback.review || '';
            const fHasReply = feedback.managerReply || feedback.adminReply;
            
            return (
              <div 
                key={feedback.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('input') || target.closest('.cursor-zoom-in')) {
                    return;
                  }
                  setSelectedFeedback(feedback);
                }}
                className={`bg-white rounded-2xl border transition-all duration-150 hover:shadow-md cursor-pointer overflow-hidden ${
                  isCritical 
                    ? 'border-rose-100 shadow-sm shadow-rose-100/30 hover:border-rose-300' 
                    : 'border-gray-150 shadow-sm hover:border-emerald-300'
                }`}
              >
                {/* Header segment with Customer name & info */}
                <div className={`p-4 flex flex-wrap justify-between items-start gap-3 border-b border-gray-100 ${isCritical ? 'bg-rose-50/30' : 'bg-gray-50/10'}`}>
                  
                  <div className="flex gap-3 items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      isCritical ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {feedback.customerName ? feedback.customerName.charAt(0).toUpperCase() : 'G'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-black text-gray-800">{feedback.customerName || 'Walk-in Guest'}</h4>
                        <span className="text-[10px] bg-gray-100 border border-gray-200 text-gray-500 font-extrabold px-2 py-0.5 rounded uppercase">
                          {feedback.platform || 'Dine-In'}
                        </span>
                        {isCritical && !fHasReply && (
                          <span className="text-[9px] bg-rose-500 text-white font-black px-2 py-0.5 rounded uppercase animate-pulse">
                            Action Required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5 font-medium">
                        <span className="flex items-center gap-1">
                          <Phone size={11} />
                          {feedback.customerPhone || 'N/A'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {feedback.feedbackDate ? new Date(feedback.feedbackDate).toLocaleString('en-US') : (feedback.submittedAt ? new Date(feedback.submittedAt.seconds * 1000).toLocaleString('en-US') : 'N/A')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side Metadata & actions */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">Invoice Ref</span>
                      <span className="text-xs font-mono font-bold text-gray-700 block mt-0.5">#{feedback.invoiceNo || feedback.invoiceId}</span>
                    </div>
                    
                    {/* Delete feedback record button */}
                    <button
                      onClick={() => handleDeleteFeedback(feedback.id)}
                      className="p-1.5 text-gray-300 hover:text-rose-600 transition-colors rounded-lg hover:bg-gray-50 cursor-pointer"
                      title="Remove feedback record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                </div>

                {/* Stars Breakdown details and review text block */}
                <div className="p-5 space-y-4">
                  
                  {/* Grid showing individual ratings */}
                  <div className="flex flex-wrap gap-4 text-xs font-medium border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">🍔 Food:</span>
                      <div className="flex text-amber-500">
                        {Array.from({ length: fFoodRating }).map((_, i) => <Star key={i} size={11} className="fill-amber-400 stroke-amber-400" />)}
                        {Array.from({ length: 5 - fFoodRating }).map((_, i) => <Star key={i} size={11} className="stroke-gray-300 fill-transparent" />)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">🛎️ Service:</span>
                      <div className="flex text-amber-500">
                        {Array.from({ length: feedback.serviceRating || 0 }).map((_, i) => <Star key={i} size={11} className="fill-amber-400 stroke-amber-400" />)}
                        {Array.from({ length: 5 - (feedback.serviceRating || 0) }).map((_, i) => <Star key={i} size={11} className="stroke-gray-300 fill-transparent" />)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">✨ Cleanliness:</span>
                      <div className="flex text-amber-500">
                        {Array.from({ length: fCleanlinessRating }).map((_, i) => <Star key={i} size={11} className="fill-amber-400 stroke-amber-400" />)}
                        {Array.from({ length: 5 - fCleanlinessRating }).map((_, i) => <Star key={i} size={11} className="stroke-gray-300 fill-transparent" />)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-gray-500 font-extrabold uppercase text-[10px]">Overall:</span>
                      <span className={`font-black text-sm px-2.5 py-0.5 rounded-full ${
                        isCritical ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>{feedback.overallRating} ★</span>
                    </div>
                  </div>

                  {/* Customer Comments written text */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">Customer Review</span>
                    <p className="text-xs text-gray-700 leading-relaxed bg-gray-50/50 p-3.5 rounded-xl border border-gray-100 font-normal">
                      {fComments || <span className="text-gray-400 italic font-mono text-[11px]">The customer left star ratings only without typing comments.</span>}
                    </p>
                  </div>

                  {/* Suggestions for Improvement */}
                  {feedback.suggestions && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-amber-600 font-extrabold uppercase tracking-widest block">Suggestions for Improvement</span>
                      <p className="text-xs text-gray-700 leading-relaxed bg-amber-50/10 p-3.5 rounded-xl border border-amber-150/50 font-normal">
                        {feedback.suggestions}
                      </p>
                    </div>
                  )}

                  {/* Mini-survey responses check */}
                  {(feedback.wouldVisitAgain || feedback.wouldRecommend) && (
                    <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-500 pt-1">
                      {feedback.wouldVisitAgain && (
                        <div>
                          🔄 Visit Again: <strong className="text-gray-700 font-bold">{feedback.wouldVisitAgain}</strong>
                        </div>
                      )}
                      {feedback.wouldRecommend && (
                        <div>
                          📢 Recommend us: <strong className="text-gray-700 font-bold">{feedback.wouldRecommend}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Uploaded Customer Photos Ledger */}
                  {feedback.uploadedPhotos && feedback.uploadedPhotos.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">Uploaded Dining Photos</span>
                      <div className="flex flex-wrap gap-2.5">
                        {feedback.uploadedPhotos.map((photo, pIdx) => (
                          <div 
                            key={pIdx}
                            onClick={() => setActivePhoto(photo)}
                            className="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden cursor-zoom-in hover:scale-105 active:scale-95 transition-all"
                          >
                            <img 
                              src={photo} 
                              alt="Customer food" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manager Reply Action Section */}
                  <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
                    
                    {/* Existing reply display */}
                    {fHasReply ? (
                      <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-3.5 text-xs space-y-1 text-left animate-fade-in">
                        <div className="flex justify-between items-center text-emerald-800">
                          <span className="font-extrabold uppercase tracking-wider text-[9.5px] flex items-center gap-1">
                            <Smile size={12} />
                            Official Response Saved
                          </span>
                          <span className="text-[9px] font-medium text-emerald-600 flex items-center gap-1">
                            <CheckCircle size={10} /> Saved to Ledger
                          </span>
                        </div>
                        <p className="text-gray-600 font-medium leading-relaxed italic">
                          "{feedback.managerReply || feedback.adminReply}"
                        </p>
                      </div>
                    ) : (
                      // Reply input container
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block flex items-center gap-1">
                          <Reply size={11} /> Respond to Customer Review
                        </label>
                        <div className="flex gap-2.5">
                          <input
                            type="text"
                            value={replyText[feedback.id] || ''}
                            onChange={(e) => setReplyText(prev => ({ ...prev, [feedback.id]: e.target.value }))}
                            placeholder={isCritical 
                              ? "Apologize, address their specific issue, and offer a complimentary voucher..." 
                              : "Thank the guest for their rating and look forward to serving them again..."
                            }
                            className="flex-1 h-10 px-3.5 bg-white border border-gray-200 rounded-xl text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                          />
                          <button
                            onClick={() => handleSaveReply(feedback.id)}
                            disabled={submittingReply[feedback.id]}
                            className="h-10 px-4 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                          >
                            {submittingReply[feedback.id] ? "Saving..." : (
                              <>
                                <span>Save Reply</span>
                                <Send size={12} />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>



      {/* Selected Feedback Inspector Modal Overlay */}
      {selectedFeedback && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs z-[999] p-4 overflow-y-auto animate-fade-in">
          <div
            className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-lg w-full overflow-hidden border-t-4 border-t-emerald-500"
          >
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-150 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-gray-900 tracking-tight">Customer Feedback Inspector</h3>
                <span className="text-[10px] text-gray-400 font-bold uppercase">Invoice #{selectedFeedback.invoiceNo || selectedFeedback.invoiceId}</span>
              </div>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-800 transition-all cursor-pointer shadow-sm"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Customer information */}
              <div className="bg-emerald-50/20 border border-emerald-50 rounded-2xl p-4 flex gap-4 items-center">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-extrabold text-base border border-emerald-300">
                  {selectedFeedback.customerName ? selectedFeedback.customerName.charAt(0).toUpperCase() : 'G'}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                    {selectedFeedback.customerName || 'Walk-in Guest'}
                    <span className="text-[9px] font-black bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded uppercase">
                      {selectedFeedback.platform || 'Dine-In'}
                    </span>
                  </h4>
                  <div className="text-xs text-gray-500 space-y-0.5 mt-1 font-medium">
                    <p className="flex items-center gap-1.5">
                      <Phone size={12} className="text-gray-400" />
                      {selectedFeedback.customerPhone || 'No Phone Registered'}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-400" />
                      {selectedFeedback.feedbackDate ? new Date(selectedFeedback.feedbackDate).toLocaleString('en-US') : (selectedFeedback.submittedAt ? new Date(selectedFeedback.submittedAt.seconds * 1000).toLocaleString('en-US') : 'N/A')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Star ratings breakdown */}
              <div className="space-y-3">
                <h5 className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Ratings Breakdown</h5>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                    <span className="text-[10px] font-bold text-gray-400 block mb-1">🍔 Food</span>
                    <span className="text-base font-black text-gray-900">{(selectedFeedback.foodRating !== undefined ? selectedFeedback.foodRating : selectedFeedback.foodQualityRating) || 0}★</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                    <span className="text-[10px] font-bold text-gray-400 block mb-1">🛎️ Service</span>
                    <span className="text-base font-black text-gray-900">{selectedFeedback.serviceRating || 0}★</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                    <span className="text-[10px] font-bold text-gray-400 block mb-1">✨ Ambience</span>
                    <span className="text-base font-black text-gray-900">{(selectedFeedback.cleanlinessRating !== undefined ? selectedFeedback.cleanlinessRating : selectedFeedback.ambienceRating) || 0}★</span>
                  </div>
                </div>
                <div className="bg-emerald-50/10 border border-emerald-100 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-600 uppercase">Overall Experience Rating</span>
                  <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{selectedFeedback.overallRating} ★</span>
                </div>
              </div>

              {/* Review Comments */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">Customer Review & Comments</span>
                <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100 font-medium whitespace-pre-line italic">
                  "{selectedFeedback.comments || selectedFeedback.review || 'The customer left star ratings only without typing comments.'}"
                </p>
              </div>

              {/* Suggestions */}
              {selectedFeedback.suggestions && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-amber-600 font-extrabold uppercase tracking-widest block">Suggestions for Improvement</span>
                  <p className="text-xs text-gray-700 leading-relaxed bg-amber-50/10 p-4 rounded-2xl border border-amber-150/50 font-medium">
                    {selectedFeedback.suggestions}
                  </p>
                </div>
              )}

              {/* Survey details */}
              {(selectedFeedback.wouldVisitAgain || selectedFeedback.wouldRecommend) && (
                <div className="flex justify-around text-xs bg-gray-50 p-3 rounded-xl border border-gray-100 text-gray-500 font-medium">
                  {selectedFeedback.wouldVisitAgain && (
                    <p>🔄 Visit Again: <strong className="text-gray-900 font-bold">{selectedFeedback.wouldVisitAgain}</strong></p>
                  )}
                  {selectedFeedback.wouldRecommend && (
                    <p>📢 Recommend: <strong className="text-gray-900 font-bold">{selectedFeedback.wouldRecommend}</strong></p>
                  )}
                </div>
              )}

              {/* Uploaded Photos */}
              {selectedFeedback.uploadedPhotos && selectedFeedback.uploadedPhotos.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">Dining Photos</span>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedFeedback.uploadedPhotos.map((photo, pIdx) => (
                      <div 
                        key={pIdx}
                        onClick={() => setActivePhoto(photo)}
                        className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden cursor-zoom-in hover:scale-105 transition-all"
                      >
                        <img src={photo} alt="Food photo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Reply Area inside Modal */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                {selectedFeedback.managerReply || selectedFeedback.adminReply ? (
                  <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 text-xs space-y-1.5 text-left animate-fade-in">
                    <div className="flex justify-between items-center text-emerald-800">
                      <span className="font-extrabold uppercase tracking-wider text-[9.5px] flex items-center gap-1">
                        <Smile size={12} />
                        Official Response Saved
                      </span>
                      <span className="text-[9px] font-medium text-emerald-600 flex items-center gap-1">
                        <CheckCircle size={10} /> Saved to Ledger
                      </span>
                    </div>
                    <p className="text-gray-600 font-medium leading-relaxed italic">
                      "{selectedFeedback.managerReply || selectedFeedback.adminReply}"
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block flex items-center gap-1">
                      <Reply size={11} /> Respond to Customer Review
                    </label>
                    <div className="flex gap-2.5">
                      <input
                        type="text"
                        value={replyText[selectedFeedback.id] || ''}
                        onChange={(e) => setReplyText(prev => ({ ...prev, [selectedFeedback.id]: e.target.value }))}
                        placeholder="Apologize, address the issue, or say thank you..."
                        className="flex-1 h-10 px-3.5 bg-white border border-gray-200 rounded-xl text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                      />
                      <button
                        onClick={async () => {
                          const replyVal = replyText[selectedFeedback.id];
                          await handleSaveReply(selectedFeedback.id, replyVal);
                          // Update selectedFeedback local state so the reply shows immediately in modal
                          setSelectedFeedback(prev => prev ? {
                            ...prev,
                            managerReply: replyVal,
                            adminReply: replyVal,
                            status: 'Replied'
                          } : null);
                        }}
                        disabled={submittingReply[selectedFeedback.id]}
                        className="h-10 px-4 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        {submittingReply[selectedFeedback.id] ? "Saving..." : (
                          <>
                            <span>Save Reply</span>
                            <Send size={12} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox modal overlay */}
      {activePhoto && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setActivePhoto(null)}
        >
          <div className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-2.5">
            <button 
              onClick={() => setActivePhoto(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center cursor-pointer transition-all border border-white/20"
            >
              <X size={16} />
            </button>
            <img 
              src={activePhoto} 
              alt="Expanded view customer photo" 
              className="w-full max-h-[80vh] object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

    </PageLayout>
  );
}
