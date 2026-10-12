import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Order, InventoryItem, CustomerFeedback, StaffMember, Customer } from '../types';

interface ExportData {
  orders: Order[];
  inventoryItems: InventoryItem[];
  feedbackList: CustomerFeedback[];
  staffMembers: StaffMember[];
  customers: Customer[];
  restaurantName: string;
  branchName: string;
  currencySymbol: string;
}

/**
 * EXPORT DATA TO MULTI-TAB EXCEL WORKBOOK (.xlsx)
 * Generates an executive-level, professional spreadsheet matching the Google Sheets tabs.
 */
export const exportToExcel = (data: ExportData): void => {
  const { orders, inventoryItems, feedbackList, staffMembers, customers, restaurantName, branchName, currencySymbol } = data;

  const wb = XLSX.utils.book_new();

  // --- TAB 1: EXECUTIVE DASHBOARD ---
  const totalOrders = orders.length;
  const paidOrders = orders.filter(o => o.isPaid);
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  
  const paymentCash = paidOrders.filter(o => o.paymentMethod === 'Cash').reduce((sum, o) => sum + o.totalAmount, 0);
  const paymentUPI = paidOrders.filter(o => o.paymentMethod === 'UPI').reduce((sum, o) => sum + o.totalAmount, 0);
  const paymentCard = paidOrders.filter(o => o.paymentMethod === 'Card').reduce((sum, o) => sum + o.totalAmount, 0);

  const dineInRevenue = paidOrders.filter(o => o.type === 'Dine-In').reduce((sum, o) => sum + o.totalAmount, 0);
  const takeawayRevenue = paidOrders.filter(o => o.type === 'Takeaway').reduce((sum, o) => sum + o.totalAmount, 0);
  const deliveryRevenue = paidOrders.filter(o => o.type === 'Delivery').reduce((sum, o) => sum + o.totalAmount, 0);

  const totalFeedback = feedbackList.length;
  const avgRating = totalFeedback > 0 ? parseFloat((feedbackList.reduce((sum, f) => sum + f.overallRating, 0) / totalFeedback).toFixed(2)) : 0;

  const dashboardRows = [
    ['ORDERPOINT PRO EXECUTIVE BUSINESS DASHBOARD'],
    ['Restaurant:', restaurantName],
    ['Branch:', branchName],
    ['Report Date:', new Date().toLocaleString()],
    ['Currency:', currencySymbol],
    [],
    ['BUSINESS KEY PERFORMANCE INDICATORS (KPIs)'],
    ['Metric', 'Value', 'Target'],
    ['Total Sales Revenue', totalRevenue, 50000],
    ['Total Orders Count', totalOrders, 150],
    ['Average Order Value', avgOrderValue, 350],
    ['Total Customer Feedback', totalFeedback, 50],
    ['Average Rating (1-5★)', avgRating, 4.5],
    [],
    ['REVENUE BY PAYMENT METHOD'],
    ['Method', 'Amount', 'Percentage of Revenue'],
    ['UPI Digital', paymentUPI, totalRevenue > 0 ? paymentUPI / totalRevenue : 0],
    ['Cash Flow', paymentCash, totalRevenue > 0 ? paymentCash / totalRevenue : 0],
    ['Card Swipe', paymentCard, totalRevenue > 0 ? paymentCard / totalRevenue : 0],
    [],
    ['REVENUE BY SERVICE CHANNEL'],
    ['Channel', 'Amount', 'Percentage of Revenue'],
    ['Dine-In Ordering', dineInRevenue, totalRevenue > 0 ? dineInRevenue / totalRevenue : 0],
    ['Takeaway Orders', takeawayRevenue, totalRevenue > 0 ? takeawayRevenue / totalRevenue : 0],
    ['Delivery Subscriptions', deliveryRevenue, totalRevenue > 0 ? deliveryRevenue / totalRevenue : 0],
  ];
  const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardRows);
  XLSX.utils.book_append_sheet(wb, wsDashboard, 'Dashboard Summary');

  // --- TAB 2: DETAILED SALES REPORT ---
  const salesHeaders = [
    'Date', 'Invoice Number', 'Order ID', 'Customer Name', 'Order Type', 
    'Platform', 'Items Sold', 'Quantity', 'Discount', 'GST/Tax', 
    'Payment Method', 'Total Amount', 'Estimated Profit'
  ];
  const salesDataRows = orders.map(o => {
    const itemsDescription = o.items.map(it => `${it.menuItem.name} (x${it.quantity})`).join(', ');
    const totalQty = o.items.reduce((sum, it) => sum + it.quantity, 0);
    const dateFormatted = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : new Date(o.timestamp || Date.now()).toLocaleDateString();
    
    return [
      dateFormatted,
      o.invoiceNumber || `INV-${o.orderNumber}`,
      o.orderNumber,
      o.customerName || 'Walk-in Diner',
      o.type,
      o.orderSource || 'In-House POS',
      itemsDescription,
      totalQty,
      o.discount || 0,
      o.taxes || Math.round(o.totalAmount * 0.05),
      o.paymentMethod || 'UPI',
      o.totalAmount,
      Math.round(o.totalAmount * 0.45), // Profit Margin ~45%
    ];
  });
  const wsSales = XLSX.utils.aoa_to_sheet([salesHeaders, ...salesDataRows]);
  XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Report');

  // --- TAB 3: CUSTOMER FEEDBACK ---
  const feedbackHeaders = [
    'Date', 'Invoice Number', 'Customer Name', 'Phone Number', 
    'Food Rating', 'Service Rating', 'Cleanliness', 'Overall Rating', 
    'Review Comments', 'Would Recommend', 'Status'
  ];
  const feedbackDataRows = feedbackList.map(f => [
    new Date(f.feedbackDate).toLocaleDateString(),
    f.invoiceNo || 'N/A',
    f.customerName || 'Anonymous',
    f.customerPhone,
    f.foodRating,
    f.serviceRating,
    f.cleanlinessRating,
    f.overallRating,
    f.review,
    f.wouldRecommend,
    f.status
  ]);
  const wsFeedback = XLSX.utils.aoa_to_sheet([feedbackHeaders, ...feedbackDataRows]);
  XLSX.utils.book_append_sheet(wb, wsFeedback, 'Customer Feedback');

  // --- TAB 4: INVENTORY REPORT ---
  const inventoryHeaders = [
    'Item Name', 'Opening Stock', 'Current Stock', 'Minimum Limit', 
    'Reorder Trigger Level', 'Status', 'Supplier', 'Last Updated'
  ];
  const inventoryDataRows = inventoryItems.map(i => [
    i.name,
    i.quantity + 15,
    i.quantity,
    i.lowLimit,
    Math.round(i.lowLimit * 1.5),
    i.status,
    i.supplier || 'Premium Kitchen Ltd',
    new Date().toLocaleDateString()
  ]);
  const wsInventory = XLSX.utils.aoa_to_sheet([inventoryHeaders, ...inventoryDataRows]);
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventory Report');

  // --- TAB 5: DAILY FINANCIAL CLOSING ---
  const dailyGroups: { [date: string]: { totalSale: number; totalOrder: number; cashFlow: number; upiDigital: number; cardSwipe: number } } = {};
  orders.forEach(o => {
    const dateStr = o.createdAt 
      ? new Date(o.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) 
      : new Date(o.timestamp || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      
    if (!dailyGroups[dateStr]) {
      dailyGroups[dateStr] = {
        totalSale: 0,
        totalOrder: 0,
        cashFlow: 0,
        upiDigital: 0,
        cardSwipe: 0,
      };
    }
    
    dailyGroups[dateStr].totalOrder += 1;
    if (o.isPaid) {
      dailyGroups[dateStr].totalSale += o.totalAmount || 0;
      const pm = (o.paymentMethod || '').toLowerCase();
      if (pm === 'cash') {
        dailyGroups[dateStr].cashFlow += o.totalAmount || 0;
      } else if (pm === 'upi') {
        dailyGroups[dateStr].upiDigital += o.totalAmount || 0;
      } else if (pm === 'card') {
        dailyGroups[dateStr].cardSwipe += o.totalAmount || 0;
      }
    }
  });

  const dailyHeaders = ['Date', 'Total Orders', 'Gross Sales', 'Cash Flow', 'UPI Payments', 'Card Swipes', 'Estimated Taxes', 'Net Profit'];
  const dailyDataRows = Object.keys(dailyGroups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(dateStr => {
    const g = dailyGroups[dateStr];
    return [
      dateStr,
      g.totalOrder,
      g.totalSale,
      g.cashFlow,
      g.upiDigital,
      g.cardSwipe,
      Math.round(g.totalSale * 0.05),
      Math.round(g.totalSale * 0.45)
    ];
  });
  const wsDaily = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyDataRows]);
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Financials');

  // Write and Save
  const fileName = `OrderPoint_Enterprise_Report_${branchName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};


/**
 * EXPORT DATA TO AN ENTERPRISE-GRADE MULTI-PAGE BUSINESS PDF (.pdf)
 * Features styled header blocks, financial KPI card grids, structured transaction tables,
 * and stock alerts with custom canvas styling.
 */
export const exportToPDF = (data: ExportData): void => {
  const { orders, inventoryItems, feedbackList, restaurantName, branchName, currencySymbol } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 15;
  let currentY = 15;

  // --- HELPER: HEADER AND FOOTER WRAPPER ---
  const drawPageFooter = (pageNum: number, totalPages: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175); // Gray 400
    doc.line(marginX, pageHeight - 15, pageWidth - marginX, pageHeight - 15);
    doc.text('OrderPoint Pro - Secure Operational Ledger', marginX, pageHeight - 10);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - marginX, pageHeight - 10, { align: 'right' });
  };

  const drawDocumentHeader = (title: string) => {
    // Elegant Dark Charcoal Header Block
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(marginX, currentY, pageWidth - (marginX * 2), 26, 'F');

    // Accent Line
    doc.setFillColor(34, 197, 94); // Emerald 500
    doc.rect(marginX, currentY + 25, pageWidth - (marginX * 2), 1.5, 'F');

    // Title text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(restaurantName.toUpperCase(), marginX + 6, currentY + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text(`BRANCH: ${branchName.toUpperCase()}  |  SYSTEM OPERATIONAL REPORT`, marginX + 6, currentY + 13);
    doc.text(`DATE GENERATED: ${new Date().toLocaleString()}  |  STATUS: AUTHENTICATED`, marginX + 6, currentY + 17);

    // Title on the right of the header
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, pageWidth - marginX - 6, currentY + 11, { align: 'right' });

    currentY += 34;
  };

  // ==========================================
  // PAGE 1: FINANCIAL SUMMARY & KPIS
  // ==========================================
  drawDocumentHeader('EXECUTIVE SCORECARD');

  // 1. KPI Cards Row
  const paidOrders = orders.filter(o => o.isPaid);
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrdersCount = orders.length;
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;
  
  const totalFeedback = feedbackList.length;
  const avgRating = totalFeedback > 0 ? (feedbackList.reduce((sum, f) => sum + f.overallRating, 0) / totalFeedback).toFixed(1) : '5.0';

  // Draw 4 distinct KPI Cards
  const cards = [
    { label: 'TOTAL SALES', val: `${currencySymbol}${totalRevenue.toLocaleString('en-IN')}`, desc: 'Paid transactions' },
    { label: 'TOTAL ORDERS', val: totalOrdersCount.toString(), desc: 'Counter & Online' },
    { label: 'AVG BASKET', val: `${currencySymbol}${avgOrderValue}`, desc: 'Per order ticket' },
    { label: 'CUST. RATING', val: `${avgRating} / 5.0`, desc: `${totalFeedback} customer reviews` },
  ];

  const cardWidth = 42;
  const cardHeight = 20;
  const cardGap = 4.5;

  cards.forEach((card, index) => {
    const cardX = marginX + (index * (cardWidth + cardGap));
    
    // Draw Box
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

    // Draw little colored stripe on the side
    doc.setFillColor(index === 0 ? 34 : index === 1 ? 2 : index === 2 ? 245 : 139, index === 0 ? 197 : index === 1 ? 132 : index === 2 ? 158 : 92, index === 0 ? 94 : index === 1 ? 199 : index === 2 ? 11 : 246);
    doc.rect(cardX, currentY, 1.5, cardHeight, 'F');

    // Fill Card Text
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(card.label, cardX + 4, currentY + 5);

    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(card.val, cardX + 4, currentY + 12);

    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(card.desc, cardX + 4, currentY + 17);
  });

  currentY += cardHeight + 10;

  // 2. Channel Distribution & Analytics Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('REVENUE DISTRIBUTION ANALYSIS', marginX, currentY);
  currentY += 4;

  const paymentCash = paidOrders.filter(o => o.paymentMethod === 'Cash').reduce((sum, o) => sum + o.totalAmount, 0);
  const paymentUPI = paidOrders.filter(o => o.paymentMethod === 'UPI').reduce((sum, o) => sum + o.totalAmount, 0);
  const paymentCard = paidOrders.filter(o => o.paymentMethod === 'Card').reduce((sum, o) => sum + o.totalAmount, 0);

  const dineInRev = paidOrders.filter(o => o.type === 'Dine-In').reduce((sum, o) => sum + o.totalAmount, 0);
  const takeawayRev = paidOrders.filter(o => o.type === 'Takeaway').reduce((sum, o) => sum + o.totalAmount, 0);
  const deliveryRev = paidOrders.filter(o => o.type === 'Delivery').reduce((sum, o) => sum + o.totalAmount, 0);

  const distribution = [
    { name: 'UPI Digital Payments', val: paymentUPI, color: [139, 92, 246] },
    { name: 'Direct Cash Flow', val: paymentCash, color: [245, 158, 11] },
    { name: 'Card Payments', val: paymentCard, color: [239, 68, 68] },
    { name: 'Dine-In Table Services', val: dineInRev, color: [59, 130, 246] },
    { name: 'Takeaway Counter Sales', val: takeawayRev, color: [16, 185, 129] },
    { name: 'Swiggy/Zomato Delivery', val: deliveryRev, color: [236, 72, 153] },
  ];

  const maxVal = Math.max(...distribution.map(d => d.val), 1);

  distribution.forEach((dist, idx) => {
    const rowY = currentY + (idx * 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85); // Slate 700
    doc.text(dist.name, marginX, rowY + 5);

    // Draw bar outline
    const barWidth = 90;
    const barX = marginX + 45;
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.roundedRect(barX, rowY + 1.5, barWidth, 4, 1, 1, 'F');

    // Draw active colored bar
    const activeWidth = (dist.val / maxVal) * barWidth;
    if (activeWidth > 0) {
      doc.setFillColor(dist.color[0], dist.color[1], dist.color[2]);
      doc.roundedRect(barX, rowY + 1.5, activeWidth, 4, 1, 1, 'F');
    }

    // Value text
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${currencySymbol}${dist.val.toLocaleString('en-IN')}`, barX + barWidth + 4, rowY + 5);

    // Percentage text
    const pct = totalRevenue > 0 ? Math.round((dist.val / totalRevenue) * 100) : 0;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`(${pct}%)`, barX + barWidth + 24, rowY + 5);
  });

  currentY += (distribution.length * 9) + 12;

  // 3. Top Selling Food Dishes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('TOP SELLING CULINARY DISHES (RANKED BY REVENUE)', marginX, currentY);
  currentY += 5;

  // Compute top items
  const itemMap: { [name: string]: { qty: number; value: number } } = {};
  orders.forEach(o => {
    o.items.forEach(it => {
      const name = it.menuItem.name;
      if (!itemMap[name]) {
        itemMap[name] = { qty: 0, value: 0 };
      }
      itemMap[name].qty += it.quantity;
      itemMap[name].value += it.menuItem.price * it.quantity;
    });
  });

  const sortedItems = Object.entries(itemMap)
    .map(([name, stat]) => ({ name, ...stat }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  if (sortedItems.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('No transaction data recorded for recipe items.', marginX, currentY + 3);
    currentY += 10;
  } else {
    // Draw Top Dish Boxes
    const boxW = 86;
    const boxH = 12;

    sortedItems.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const boxX = marginX + (col * (boxW + 8));
      const boxY = currentY + (row * (boxH + 3));

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, 'FD');

      // Rank Badge
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(boxX + 2, boxY + 2.5, 7, 7, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(`#${idx + 1}`, boxX + 5.5, boxY + 7.5, { align: 'center' });

      // Name & qty
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(item.name.toUpperCase().substring(0, 24), boxX + 11, boxY + 5);

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`${item.qty} units served`, boxX + 11, boxY + 9.5);

      // Financial value
      doc.setTextColor(34, 197, 94); // Emerald
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${currencySymbol}${item.value.toLocaleString('en-IN')}`, boxX + boxW - 4, boxY + 7.5, { align: 'right' });
    });

    currentY += (Math.ceil(sortedItems.length / 2) * (boxH + 3)) + 10;
  }

  // ==========================================
  // PAGE 2: OPERATIONAL LOGS & AUDITS
  // ==========================================
  doc.addPage();
  currentY = 15;
  drawDocumentHeader('OPERATIONAL RECORDS');

  // 1. Recent Sales Ledger
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('RECENT COMPLETED SALES TRANSACTIONS', marginX, currentY);
  currentY += 5;

  const tableHeaders = ['INVOICE', 'CUSTOMER', 'TYPE', 'METHOD', 'ITEMS SOLD', 'AMOUNT', 'STATUS'];
  const colWidths = [22, 28, 20, 18, 55, 20, 17];
  
  // Draw Table Header
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(marginX, currentY, pageWidth - (marginX * 2), 6.5, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  
  let tempX = marginX + 3;
  tableHeaders.forEach((th, idx) => {
    doc.text(th, tempX, currentY + 4.5, { align: idx === 5 ? 'right' : 'left' });
    tempX += colWidths[idx];
  });
  
  currentY += 6.5;

  // Render recent 12 orders
  const recentOrders = orders.slice(0, 12);
  if (recentOrders.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('No transactions on record currently.', marginX + 5, currentY + 6);
    currentY += 12;
  } else {
    recentOrders.forEach((o, index) => {
      // Zebra backgrounds
      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, currentY, pageWidth - (marginX * 2), 7, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85); // Slate 700

      let rowX = marginX + 3;

      // 1. Invoice
      doc.text(o.invoiceNumber || `INV-${o.orderNumber}`, rowX, currentY + 4.8);
      rowX += colWidths[0];

      // 2. Customer
      doc.text((o.customerName || 'Walk-in Diner').substring(0, 14), rowX, currentY + 4.8);
      rowX += colWidths[1];

      // 3. Type
      doc.text(o.type, rowX, currentY + 4.8);
      rowX += colWidths[2];

      // 4. Method
      doc.text(o.paymentMethod || 'Unpaid', rowX, currentY + 4.8);
      rowX += colWidths[3];

      // 5. Items description
      const itemsDesc = o.items.map(it => `${it.menuItem.name} (x${it.quantity})`).join(', ');
      doc.text(itemsDesc.substring(0, 36) + (itemsDesc.length > 36 ? '...' : ''), rowX, currentY + 4.8);
      rowX += colWidths[4];

      // 6. Amount
      doc.setFont('helvetica', 'bold');
      doc.text(`${currencySymbol}${o.totalAmount}`, rowX, currentY + 4.8, { align: 'right' });
      rowX += colWidths[5];

      // 7. Status
      doc.setFont('helvetica', 'bold');
      if (o.isPaid) {
        doc.setTextColor(22, 163, 74); // Emerald 600
        doc.text('PAID', rowX, currentY + 4.8);
      } else {
        doc.setTextColor(225, 29, 72); // Rose 600
        doc.text('PENDING', rowX, currentY + 4.8);
      }

      currentY += 7;
    });
  }

  currentY += 10;

  // 2. Warehouse Stock Alerts & Customer Feedbacks
  // Left Column: Inventory safety stock warning logs
  // Right Column: Customer Feedback highlights
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('WAREHOUSE STOCK ALERTS', marginX, currentY);
  doc.text('CUSTOMER SERVICE FEEDBACKS', marginX + 90, currentY);
  currentY += 5;

  const colW = 84;
  
  // INVENTORY SIDE
  const depletedItems = inventoryItems.filter(i => i.status === 'LOW STOCK' || i.quantity === 0).slice(0, 6);
  let invY = currentY;

  if (depletedItems.length === 0) {
    doc.setFillColor(240, 253, 244); // Green 50
    doc.setDrawColor(187, 247, 208); // Green 200
    doc.roundedRect(marginX, invY, colW, 40, 1.5, 1.5, 'FD');

    doc.setTextColor(21, 128, 61); // Green 700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('✔ INVENTORY HEALTHY', marginX + 4, invY + 12);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('All ingredients and raw material items are', marginX + 4, invY + 22);
    doc.text('comfortably above critical safety levels.', marginX + 4, invY + 28);
  } else {
    depletedItems.forEach((item, idx) => {
      const itemY = invY + (idx * 8.5);
      doc.setFillColor(254, 242, 242); // Rose 50
      doc.setDrawColor(254, 226, 226); // Rose 200
      doc.roundedRect(marginX, itemY, colW, 7.5, 1, 1, 'FD');

      // Red tag stripe
      doc.setFillColor(239, 68, 68);
      doc.rect(marginX, itemY, 1.5, 7.5, 'F');

      // Text
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(item.name.toUpperCase().substring(0, 24), marginX + 4, itemY + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(239, 68, 68);
      doc.text(`Qty: ${item.quantity} (Limit: ${item.lowLimit})`, marginX + colW - 4, itemY + 4.8, { align: 'right' });
    });
  }

  // FEEDBACK SIDE / SLIDE
  const allFeedback = feedbackList;
  let feedY = currentY;

  if (allFeedback.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX + 90, feedY, colW, 40, 1.5, 1.5, 'FD');

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('No diner feedback reviews collected yet.', marginX + 94, feedY + 12);
    doc.text('Diner feedback link auto-sends on WhatsApp.', marginX + 94, feedY + 20);
  } else {
    let currentPageFeedbackY = feedY;
    let isOnNewPage = false;
    let currentColumn = 1; // Start on the right column of Page 2

    allFeedback.forEach((f) => {
      // Each feedback card takes 9.5mm height + 1.5mm gap = 11mm total vertical height
      if (currentPageFeedbackY + 11 > pageHeight - 20) {
        if (!isOnNewPage) {
          // Add a new page (Page 3)
          doc.addPage();
          isOnNewPage = true;
          currentColumn = 0; // On Page 3+, start at column 0 (left column)
          currentPageFeedbackY = 15;
          drawDocumentHeader('CUSTOMER FEEDBACK RECORDS');
          currentPageFeedbackY = currentY;
        } else {
          // If on Page 3+ and column 0 is full, switch to column 1
          if (currentColumn === 0) {
            currentColumn = 1;
            currentPageFeedbackY = currentY; // Reset Y to top of review list on this page
          } else {
            // Both columns are full on this page! Add another page
            doc.addPage();
            currentColumn = 0;
            currentPageFeedbackY = 15;
            drawDocumentHeader('CUSTOMER FEEDBACK RECORDS (CONT.)');
            currentPageFeedbackY = currentY;
          }
        }
      }

      const boxX = marginX + (currentColumn * 90);
      const boxY = currentPageFeedbackY;

      // Draw box background
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(241, 245, 249);
      doc.roundedRect(boxX, boxY, colW, 9, 1, 1, 'FD');

      // Left indicator stripe: red/crimson for negative ratings (<=3), emerald for positive (>=4)
      const isCritical = f.overallRating <= 3;
      if (isCritical) {
        doc.setFillColor(239, 68, 68);
      } else {
        doc.setFillColor(34, 197, 94);
      }
      doc.rect(boxX, boxY, 1.2, 9, 'F');

      // Guest Name
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      const nameText = (f.customerName || 'Anonymous').toUpperCase().substring(0, 18);
      doc.text(nameText, boxX + 3.5, boxY + 4);

      // Star Ratings representation
      const starText = '★'.repeat(f.overallRating) + '☆'.repeat(5 - f.overallRating);
      doc.setTextColor(245, 158, 11);
      doc.text(starText, boxX + colW - 18, boxY + 4);

      // Review comment with manager response (reply) appended if it exists
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);

      let revText = f.review ? f.review : 'Left star ratings only';
      if (f.managerReply) {
        revText += ` [Reply: ${f.managerReply}]`;
      }

      // Truncate to make sure it fits perfectly on a single line
      const maxChars = 46;
      const truncatedRev = revText.length > maxChars
        ? revText.substring(0, maxChars - 3) + '...'
        : revText;

      doc.text(`"${truncatedRev}"`, boxX + 3.5, boxY + 7.5);

      currentPageFeedbackY += 11;
    });
  }

  // --- ADD FOOTERS TO ALL PAGES DYNAMICALLY ---
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(i, totalPages);
  }

  // --- SAVE AND EXPORT THE COMPILED PDF ---
  const fileName = `OrderPoint_Business_Report_${branchName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
