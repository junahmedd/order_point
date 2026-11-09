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
      pillVariant="green"
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

      {/* Grid Cards - 5 Cards Per Row on Standard Screens */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredItems.map(item => {
            return (
              <div
                id={`menu_card_${item.id}`}
                key={item.id}
                className="bg-white border border-[#EDEDED] rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_18px_rgba(0,0,0,0.06)] transition-all duration-200 w-full overflow-hidden flex flex-col justify-between"
              >
                {/* Dish Image Banner */}
                <div className="w-full h-24 bg-gray-50 relative overflow-hidden flex-shrink-0 border-b border-gray-100 flex items-center justify-center">
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
                  <div className={`fallback-placeholder-card absolute inset-0 bg-gray-50 flex flex-col items-center justify-center text-center p-2 ${item.imageUrl ? 'hidden' : ''}`}>
                    <Utensils size={16} className="text-gray-300 mb-0.5" />
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">No Image</span>
                  </div>
                </div>

                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  {/* Category and Price Row */}
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`px-1.5 py-0.5 text-[8px] font-extrabold tracking-widest uppercase rounded-full ${handleCategoryPillBg(item.category)}`}>
                      {item.category}
                    </span>
                    <span className="text-xs font-black text-[#111111] tracking-tight">
                      <span>{currencySymbol}{item.price}</span>
                    </span>
                  </div>

                  {/* Name and Description */}
                  <h3 className="text-xs font-black text-[#111111] mb-0.5 leading-tight tracking-tight line-clamp-1" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-medium leading-normal mb-1.5 line-clamp-1" title={item.description}>
                    {item.description}
                  </p>

                  {/* Availability Row */}
                  <div className="flex justify-between items-center mb-2 mt-auto pt-1 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                       {(() => {
                         const isAvail = item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable;
                         if (!isAvail) {
                           return (
                             <>
                               <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                               <span className="text-[8px] font-extrabold tracking-wider uppercase text-rose-500">OFF</span>
                             </>
                           );
                         }
                         return (
                           <>
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                             <span className="text-[8px] font-extrabold tracking-wider uppercase text-emerald-600">ACTIVE</span>
                           </>
                         );
                       })()}
                    </div>
                    {/* Custom Toggle Switch */}
                    <button
                      id={`btn_toggle_avail_${item.id}`}
                      onClick={() => handleToggleAvailable(item)}
                      className={`w-[30px] h-[16px] rounded-full p-0.5 transition-colors duration-200 flex items-center shrink-0 cursor-pointer ${
                        (item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable) ? 'bg-[#22C55E]' : 'bg-gray-200'
                      }`}
                    >
                      <div
                        className={`w-[12px] h-[12px] rounded-full bg-white shadow-xs transform transition-transform duration-200 ${
                          (item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable) ? 'translate-x-[14px]' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEditModal(item)}
                      className="flex-1 h-7 rounded-lg border border-gray-200 bg-white text-[#111111] hover:bg-gray-50 flex items-center justify-center gap-1 text-[8.5px] font-extrabold tracking-wider uppercase transition-colors"
                    >
                      <Edit2 size={10} className="text-gray-500"/> EDIT
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                          onDeleteMenuItem(item.id);
                          onShowToast(`Deleted ${item.name} from manual registry`);
                        }
                      }}
                      className="flex-1 h-7 rounded-lg border border-rose-100 bg-white text-rose-500 hover:bg-rose-50 flex items-center justify-center gap-1 text-[8.5px] font-extrabold tracking-wider uppercase transition-colors"
                    >
                      <Trash2 size={10} className="text-rose-400"/> DEL
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>


      {/* Add Item Modal Overlay Drawer */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4.5 shadow-2xl border border-gray-100 animate-fade-in space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Utensils className="text-[#111111]" size={16} />
                <h3 className="text-sm font-black text-[#111111] uppercase tracking-wide">
                  {editingItem ? 'Edit Menu' : 'Add Menu'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsAddModalOpen(false);
                }}
                className="text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">Dish Name</label>
                <input
                  id="modal_dish_name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Garlic Naan"
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white"
                  required
                />
              </div>

              {/* Category & Price in 2 Columns */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">Category</label>
                  <select
                    id="modal_dish_category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className="w-full h-9 px-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:bg-white"
                  >
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Drinks">Drinks</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">Price ({currencySymbol})</label>
                  <input
                    id="modal_dish_price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="150"
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">Dish Image URL</label>
                <input
                  id="modal_dish_image_url"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">Description</label>
                <textarea
                  id="modal_dish_desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description of the dish"
                  rows={2}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white resize-none"
                  required
                />
              </div>

              <button
                id="modal_save_dish_btn"
                type="submit"
                className="w-full h-9.5 bg-[#111111] hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-[0.99] border-none cursor-pointer mt-1"
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
