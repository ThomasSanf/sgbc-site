import 'server-only';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { confirmationCopy, orderDate, orderMoney, type OrderConfirmation } from '../order-confirmation';
import type { Locale } from '../site-copy';

export async function createOrderPdf(order: OrderConfirmation, locale: Locale, generatedAt = Date.now()): Promise<Buffer> {
  const copy = confirmationCopy[locale], money = (value: number) => orderMoney(value, order.currency, locale);
  const doc = new PDFDocument({ size:'A4', margin:0, bufferPages:true, font:path.join(process.cwd(),'assets/fonts/NotoSansTC-Regular.otf'), info:{ Title:`SGBC - ${copy.document} - ${order.reference}`, Author:'SGBC', Creator:'SGBC', CreationDate:new Date(generatedAt), ModDate:new Date(generatedAt) } });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve,reject) => { doc.on('data',(chunk: Buffer) => chunks.push(chunk)); doc.on('end',() => resolve(Buffer.concat(chunks))); doc.on('error',reject); });
  const ink = '#202719', muted = '#646e59', orange = '#e54a1a', rule = '#d6dbcc';
  const left = 42, right = 553, width = right-left;
  let y = 100;
  const clean = (value: string) => Array.from(value).filter(char => char === '\n' || char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).map(char => char !== '\n' && /\s/u.test(char) ? ' ' : char).join('');
  function draw(value: string,x: number,top: number,size = 10,color = ink) { doc.fontSize(size).fillColor(color).text(clean(value),x,top,{lineBreak:false}); }
  function header() { doc.rect(0,0,596,76).fill('#141a11'); draw('sgbc',left,13,31,'#f5f5eb'); draw(copy.document,350,29,12,'#d1dec2'); }
  header();
  function ensure(height: number) { if (y+height > 765) { doc.addPage(); header(); y=100; } }
  function lines(value: string,size: number,maxWidth: number) {
    const result: string[] = [];
    doc.fontSize(size);
    for (const paragraph of clean(value).split('\n')) {
      let line = '';
      for (const char of paragraph) {
        if (line && doc.widthOfString(line+char) > maxWidth) {
          const space = line.lastIndexOf(' ');
          if (space > line.length/2) { result.push(line.slice(0,space)); line=line.slice(space+1)+char; }
          else { result.push(line); line=char; }
        } else line+=char;
      }
      result.push(line.trimEnd());
    }
    return result;
  }
  function paragraph(value: string,x=left,maxWidth=width,size=10,color=ink) {
    for (const line of lines(value,size,maxWidth)) { ensure(size*1.5); draw(line,x,y,size,color); y+=size*1.5; }
  }
  function divider() { ensure(24); y+=6; doc.moveTo(left,y).lineTo(right,y).lineWidth(.65).strokeColor(rule).stroke(); y+=18; }
  function columns(items: Array<{label:string;value:string}>) {
    const colWidth=(width-26)/2;
    const wrapped=items.map(item => lines(item.value,10,colWidth));
    const height=21+Math.max(...wrapped.map(item => item.length))*15;
    ensure(height);
    items.forEach((item,index) => {
      const x=left+index*(colWidth+26);
      draw(item.label,x,y,8,muted);
      wrapped[index].forEach((line,lineIndex) => draw(line,x,y+18+lineIndex*15));
    });
    y+=height;
  }
  paragraph(copy[order.status],left,width,20);
  if (order.sandbox) { y+=5; paragraph(copy.sandbox,left,width,10,orange); }
  y+=16;
  columns([{label:copy.order,value:order.reference},{label:copy.date,value:orderDate(order.createdAt,locale)}]);
  y+=12;
  columns([{label:copy.payment,value:`${order.provider === 'ecpay' ? 'ECPay' : 'Stripe'} / ${copy.method}`},{label:copy.reference,value:order.paymentReference ?? '-'}]);
  divider();
  paragraph(copy.product,left,width,8,muted); y+=4;
  paragraph(order.productName,left,width,15);
  paragraph(order.sku,left,width,9,muted); y+=10;
  columns([{label:copy.quantity,value:String(order.quantity)},{label:copy.unitPrice,value:money(order.unitPrice)}]);
  divider();
  function amount(label:string,value:number,prominent=false) {
    ensure(30); const size=prominent ? 16 : 11;
    draw(label,left,y,size,prominent ? ink : muted);
    doc.fontSize(size); const text=money(value);
    draw(text,right-doc.widthOfString(text),y,size);
    y+=prominent ? 30 : 23;
  }
  amount(copy.subtotal,order.subtotal); amount(copy.shippingFee,order.shippingFee); y+=5; amount(copy.total,order.total,true);
  if (order.refundedAmount > 0) amount(copy.refund,order.refundedAmount);
  divider();
  const address=order.shipping;
  columns([{label:copy.customer,value:`${order.name}\n${order.email}`},{label:copy.delivery,value:address ? [order.name,address.phone,`${address.postalCode} ${address.city} ${address.district}`,address.address,address.country === 'TW' ? copy.taiwan : address.country].filter(Boolean).join('\n') : copy.noAddress}]);
  if (order.trackingNumber) { y+=15; paragraph(`${copy.tracking}: ${order.trackingNumber}`); }
  divider();
  paragraph(copy.preorder,left,width,9,muted); y+=5;
  paragraph(copy.notInvoice,left,width,9,muted); y+=8;
  paragraph(`${copy.generated}: ${orderDate(generatedAt,locale)}`,left,width,8,muted);
  if (order.status === 'pending') { y+=8; paragraph(copy.pendingBody,left,width,9,orange); }
  const range=doc.bufferedPageRange();
  for (let index=0;index<range.count;index++) {
    doc.switchToPage(index);
    doc.moveTo(left,798).lineTo(right,798).lineWidth(.5).strokeColor(rule).stroke();
    draw('SGBC / '+order.reference,left,808,8,muted); draw(`${index+1} / ${range.count}`,525,808,8,muted);
  }
  doc.end();
  return output;
}
