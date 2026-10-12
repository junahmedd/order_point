/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, FormEvent } from 'react';
import PageLayout from './PageLayout';
import { Utensils, Search, Plus, Edit2, Trash2, Check, X, Sparkles, Filter, AlertCircle, LayoutGrid, List } from 'lucide-react';
import { MenuItem, Category } from '../types';

interface MenuCatalogProps {
  menuItems: MenuItem[];
  onAddMenuItem: (item: MenuItem) => void;
  onUpdateMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem: (id: string) => void;
  onShowToast: (msg: string) => void;
  settings?: any;
  onNavigateToTab?: (tab: any) => void;
}

export default function MenuCatalog({
  menuItems,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onShowToast,
  settings,
  onNavigateToTab
}: MenuCatalogProps) {
  const currencySymbol = settings?.prefCurrency || '₹';
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add/Edit item state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('180');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Veg');
  const [imageUrl, setImageUrl] = useState('');
  
  // Custom states for availability and portion variants
  const [isAvailableForOrder, setIsAvailableForOrder] = useState(true);
  const [hasVariants, setHasVariants] = useState(false);
  const [halfPrice, setHalfPrice] = useState('120');
  const [isHalfAvailable, setIsHalfAvailable] = useState(true);
  const [fullPrice, setFullPrice] = useState('220');
  const [isFullAvailable, setIsFullAvailable] = useState(true);
  const [isHalfEnabled, setIsHalfEnabled] = useState(false);
  const [isFullEnabled, setIsFullEnabled] = useState(false);

  const filteredItems = useMemo(() => {
    return menuItems.filter(it => {
      const matchesCategory = selectedCategory === 'All' || it.category === selectedCategory;
      const matchesSearch = it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            it.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Handle Availability Toggle Switch
  const handleToggleAvailable = (item: MenuItem) => {
    const currentVal = item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable;
    const nextItem = { 
      ...item, 
      isAvailable: !currentVal,
      isAvailableForOrder: !currentVal 
    };
    onUpdateMenuItem(nextItem);
    onShowToast(`${item.name} is now ${nextItem.isAvailableForOrder ? 'Available' : 'Unavailable'}`);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setPrice('150');
    setDescription('');
    setCategory('Veg');
    setImageUrl('');
    setIsAvailableForOrder(true);
    setHasVariants(false);
    setHalfPrice('120');
    setIsHalfAvailable(true);
    setFullPrice('220');
    setIsFullAvailable(true);
    setIsHalfEnabled(false);
    setIsFullEnabled(false);
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setPrice(String(item.price));
    setDescription(item.description);
    setCategory(item.category);
    setImageUrl(item.imageUrl || '');
    setIsAvailableForOrder(item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable);
    setHasVariants(!!item.hasVariants);
    const half = item.variants?.find(v => v.name === 'Half');
    const full = item.variants?.find(v => v.name === 'Full');
    setHalfPrice(half ? String(half.price) : '120');
    setIsHalfAvailable(half ? half.isAvailable : true);
    setFullPrice(full ? String(full.price) : '220');
    setIsFullAvailable(full ? full.isAvailable : true);
    setIsHalfEnabled(!!half);
    setIsFullEnabled(!!full);
    setIsAddModalOpen(true);
  };

  const handleSaveItem = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const dotColor = category === 'Veg' ? '#10B981' : category === 'Drinks' ? '#3B82F6' : '#EF4444';
    const finalItemId = editingItem ? editingItem.id : 'm_' + Date.now();
    const finalPrice = Number(price) || 120;

    if (editingItem) {
      const updatedItem: MenuItem = {
        ...editingItem,
        name,
        price: finalPrice,
        description,
        category,
        isAvailable: isAvailableForOrder,
        isAvailableForOrder: isAvailableForOrder,
        hasVariants: false,
        variants: undefined,
        dotColor,
        imageUrl: imageUrl.trim() || ''
      };
      onUpdateMenuItem(updatedItem);
      onShowToast(`Successfully updated ${name}!`);
    } else {
      const newItem: MenuItem = {
        id: finalItemId,
        name,
        price: finalPrice,
        description,
        category,
        isAvailable: isAvailableForOrder,
        isAvailableForOrder: isAvailableForOrder,
        hasVariants: false,
        variants: undefined,
        dotColor,
        imageUrl: imageUrl.trim() || ''
      };
      onAddMenuItem(newItem);
      onShowToast(`Successfully added ${name} to the menu!`);
    }

    // Reset inputs
    setName('');
    setDescription('');
    setPrice('150');
    setImageUrl('');
    setIsAvailableForOrder(true);
    setHasVariants(false);
    setHalfPrice('120');
    setIsHalfAvailable(true);
    setFullPrice('220');
    setIsFullAvailable(true);
    setIsHalfEnabled(false);
    setIsFullEnabled(false);
    setEditingItem(null);
    setIsAddModalOpen(false);
  };

  const handleCategoryPillBg = (cat: Category) => {
    switch (cat) {
      case 'Veg': return 'bg-[#EBF7EF] text-[#22C55E]';
      case 'Non-Veg': return 'bg-[#FEF2F2] text-[#EF4444]';
      case 'Drinks': return 'bg-[#EFF5FF] text-[#3B82F6]';
      case 'Desserts': return 'bg-[#EFF5FF] text-[#3B82F6]';
    }
  };

  return (
    <PageLayout
      title="Menu Management"
      subtitle="Create and manage menu items, categories and pricing."
      id="menucatalog_view"
      activeTab="Menu"
      onTabChange={onNavigateToTab}
      actions={
        <button
          id="btn_open_add_dish"
          onClick={openAddModal}
          className="bg-[#111111] hover:bg-black text-white h-8.5 px-4.5 rounded-full text-[11px] font-black tracking-wider flex items-center justify-center gap-1.5 shadow-sm uppercase active:scale-95 cursor-pointer border-none"
        >
          <Plus size={14} className="stroke-[3]" />
          <span>Add Menu</span>
        </button>
      }
    >

      {/* Filter and Search segment strictly matching image */}
      <div className="flex flex-col lg:flex-row gap-4 items-center mb-8">
        <div className="relative w-full lg:max-w-md flex-1">
          <input
            id="catalog_search_bar"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full h-[50px] px-6 bg-[#FCFCFD] border-none rounded-2xl text-[13px] font-semibold text-[#111111] focus:outline-none focus:ring-1 focus:ring-gray-200 placeholder-gray-400 transition-colors"
          />
        </div>

        {/* Category Filter Horizontal pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Veg', 'Non-Veg', 'Drinks', 'Desserts'] as const).map(cat => (
            <button
              id={`pill_filter_${cat.replace(' ', '')}`}
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 h-[50px] rounded-2xl text-[13px] font-bold tracking-wide transition-all ${
                selectedCategory === cat
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'bg-white border border-[#EDEDED] text-gray-500 hover:text-[#111111]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredItems.map(item => {
            return (
              <div
                id={`menu_card_${item.id}`}
                key={item.id}
                className="bg-white border border-[#EDEDED] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 w-full mx-auto overflow-hidden flex flex-col"
              >
                {/* Dish Image Banner */}
                <div className="w-full h-32 bg-gray-50 relative overflow-hidden flex-shrink-0 border-b border-gray-100 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).onerror = null;
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          const fb = parent.querySelector('.fallback-placeholder-card');
                          if (fb) fb.classList.remove('hidden');
                        }
                      }}
                    />
                  ) : null}
                  <div className={`fallback-placeholder-card absolute inset-0 bg-gray-50 flex flex-col items-center justify-center text-center p-3 ${item.imageUrl ? 'hidden' : ''}`}>
                    <Utensils size={20} className="text-gray-300 mb-1" />
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">No Image</span>
                  </div>
                </div>

                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  {/* Category and Price Row */}
                  <div className="flex justify-between items-center mb-2">
                    <span className={`px-2 py-0.5 text-[9px] font-extrabold tracking-widest uppercase rounded-full ${handleCategoryPillBg(item.category)}`}>
                      {item.category}
                    </span>
                    <span className="text-sm font-black text-[#111111] tracking-tight">
                      <span>{currencySymbol}{(item.price / 2).toFixed(0)} - {currencySymbol}{item.price}</span>
                    </span>
                  </div>

                  {/* Name and Description */}
                  <h3 className="text-sm font-black text-[#111111] mb-1 leading-tight tracking-tight line-clamp-1" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium leading-normal mb-2 line-clamp-2 h-7" title={item.description}>
                    {item.description}
                  </p>

                  {/* Portion details block */}
                  <div className="my-2 p-2 bg-[#F8FAFC] rounded-lg border border-slate-100 text-[10px] space-y-1.5 shrink-0 select-none">
                    <span className="font-extrabold text-slate-400 block uppercase tracking-widest text-[8px] mb-0.5">Portions</span>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-600">Half portion</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-800">{currencySymbol}{(item.price / 2).toFixed(0)}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        <span className="text-[8.5px] font-[800] uppercase tracking-wide text-sky-700">Avail</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-600">Full portion</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-800">{currencySymbol}{item.price}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        <span className="text-[8.5px] font-[800] uppercase tracking-wide text-sky-700">Avail</span>
                      </div>
                    </div>
                  </div>

                  {/* Availability Row */}
                  <div className="flex justify-between items-center mb-3 mt-auto">
                    <div className="flex items-center gap-1.5">
                       {(() => {
                         const isAvail = item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable;
                         if (!isAvail) {
                           return (
                             <>
                               <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                               <span className="text-[9px] font-extrabold tracking-widest uppercase text-rose-500">UNAVAILABLE</span>
                             </>
                           );
                         }
                         return (
                           <>
                             <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                             <span className="text-[9px] font-extrabold tracking-widest uppercase text-sky-700">AVAILABLE</span>
                           </>
                         );
                       })()}
                    </div>
                    {/* Custom Toggle Switch */}
                    <button
                      id={`btn_toggle_avail_${item.id}`}
                      onClick={() => handleToggleAvailable(item)}
                      className={`w-[36px] h-[18px] rounded-full p-0.5 transition-colors duration-200 flex items-center shrink-0 cursor-pointer ${
                        (item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable) ? 'bg-[#22C55E]' : 'bg-gray-200'
                      }`}
                    >
                      <div
                        className={`w-[14px] h-[14px] rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                          (item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable) ? 'translate-x-[18px]' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(item)}
                      className="flex-1 h-8 rounded-lg border border-gray-100 bg-white text-[#111111] hover:bg-gray-50 flex items-center justify-center gap-1.5 text-[9px] font-extrabold tracking-widest uppercase transition-colors"
                    >
                      <Edit2 size={11} className="text-gray-500"/> EDIT
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                          onDeleteMenuItem(item.id);
                          onShowToast(`Deleted ${item.name} from manual registry`);
                        }
                      }}
                      className="flex-1 h-8 rounded-lg border border-rose-50 bg-white text-rose-500 hover:bg-rose-50 flex items-center justify-center gap-1.5 text-[9px] font-extrabold tracking-widest uppercase transition-colors"
                    >
                      <Trash2 size={11} className="text-rose-400"/> DELETE
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>


      {/* Add Item Modal Overlay Drawer */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 shadow-xl border border-[#EEEEEE] animate-fade-in space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Utensils className="text-[#111111]" size={18} />
                <h3 className="text-lg font-bold text-[#111111]">
                  {editingItem ? 'Edit Menu Catalog Dish' : 'Add Menu Catalog Dish'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsAddModalOpen(false);
                }}
                className="text-gray-400 hover:text-gray-600 focus:outline-[#111111]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#8A8A8A] uppercase block">Dish Name</label>
                <input
                  id="modal_dish_name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Garlic Naan"
                  className="w-full h-11 px-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#8A8A8A] uppercase block">Category</label>
                    <select
                      id="modal_dish_category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as Category)}
                      className="w-full h-11 px-3 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none"
                    >
                      <option value="Veg">Veg</option>
                      <option value="Non-Veg">Non-Veg</option>
                      <option value="Drinks">Drinks</option>
                      <option value="Desserts">Desserts</option>
                    </select>
                  </div>

                  {/* Available for Orders Toggle */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#8A8A8A] uppercase block">Available for Orders</label>
                    <button
                      type="button"
                      onClick={() => setIsAvailableForOrder(!isAvailableForOrder)}
                      className={`w-full h-11 px-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer border-solid ${
                        isAvailableForOrder ? 'text-emerald-600 border-emerald-200 bg-emerald-50/20' : 'text-gray-400'
                      }`}
                    >
                      <span>{isAvailableForOrder ? '🟢 ON' : '🔴 OFF'}</span>
                      <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 flex items-center ${
                        isAvailableForOrder ? 'bg-emerald-500' : 'bg-gray-200'
                      }`}>
                        <div className={`w-3 h-3 rounded-full bg-white shadow-xs transform transition-transform duration-200 ${
                          isAvailableForOrder ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </div>
                    </button>
                  </div>
                </div>

                {/* Price Input block */}
                <div className="space-y-1 text-left">
                  <label className="text-xs font-bold text-[#8A8A8A] uppercase block">Price (Full Price) ({currencySymbol})</label>
                  <input
                    id="modal_dish_price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full h-11 px-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#8A8A8A] uppercase block">Dish Image URL</label>
                <input
                  id="modal_dish_image_url"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="e.g. https://images.unsplash.com/photo-..."
                  className="w-full h-11 px-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#8A8A8A] uppercase block">Description</label>
                <textarea
                  id="modal_dish_desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description of the item"
                  rows={2}
                  className="w-full p-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white resize-none"
                  required
                />
              </div>

              <button
                id="modal_save_dish_btn"
                type="submit"
                className="w-full h-[52px] bg-[#111111] hover:bg-[#222222] text-white rounded-[16px] text-sm font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.99]"
              >
                {editingItem ? 'Update Menu Item' : 'Save Menu Item'}
              </button>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
