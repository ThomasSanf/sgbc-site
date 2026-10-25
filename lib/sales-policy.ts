export const salesPolicy = {
  en: {
    title: 'Sales policy',
    introduction: 'Returns, cancellations and delivery for SGBC consoles.',
    updated: 'Effective October 25, 2026',
    back: 'Back to SGBC', language: '繁體中文', read: 'Read the sales policy',
    full: 'Open full policy (new tab)', accept: 'I have read and agree to the sales policy.',
    required: 'Please read and accept the sales policy before continuing to payment.',
    rights: 'These terms do not limit your mandatory rights under applicable consumer protection laws.',
    sections: [
      { title: 'Quality control', paragraphs: ['Every SGBC console is individually inspected and functionally tested before dispatch.'] },
      { title: 'Returns and cancellations', paragraphs: [
        'SGBC does not offer additional change-of-mind returns or exchanges beyond those required by applicable law. For eligible online purchases delivered in Taiwan, customers may cancel within the statutory seven-day period by returning the goods or sending written notice, including email. No cancellation, processing, or return-shipping fee applies to a valid statutory cancellation.',
        'Please return the console with its supplied accessories and documentation. Opening the packaging for necessary inspection does not, by itself, remove your cancellation rights.',
      ] },
      { title: 'Defective or incorrect products', paragraphs: ['If your console arrives faulty, incomplete, or different from your order, contact SGBC with your order number and a description of the issue. We will assess the problem and provide the remedy required by applicable law. Pre-shipment testing does not limit these rights.'] },
      { title: 'Delivery damage or loss', paragraphs: ['If your parcel arrives damaged or appears lost, contact SGBC promptly. Please retain the packaging and provide photographs where available to assist our investigation. SGBC will coordinate with the carrier and arrange the appropriate resolution. Customers are not required to obtain compensation from the carrier before exercising their rights against SGBC.'] },
      { title: 'Customer-caused damage', paragraphs: ['Damage caused by misuse, accidental damage after delivery, or modifications is not a manufacturing defect. Any paid repair will require the customer’s approval. This does not exclude unrelated defects or mandatory consumer rights.'] },
    ],
  },
  'zh-TW': {
    title: '銷售政策',
    introduction: 'SGBC 主機的退貨、解約與配送規範。',
    updated: '生效日期：2026 年 10 月 25 日',
    back: '返回 SGBC', language: 'English', read: '閱讀銷售政策',
    full: '開啟完整政策（另開分頁）', accept: '我已閱讀並同意銷售政策。',
    required: '請先閱讀並同意銷售政策，再繼續付款。',
    rights: '本政策不限制消費者依適用消費者保護法令享有的法定權利。',
    sections: [
      { title: '品質檢查', paragraphs: ['每台 SGBC 主機出貨前均會逐一檢查，並完成功能測試。'] },
      { title: '退貨與解除契約', paragraphs: [
        '除適用法律規定的情形外，SGBC 不提供額外的個人意願退換貨服務。配送至台灣且符合法定條件的網路購物，消費者得於法定七日猶豫期間內，以退回商品或發送書面通知（包括電子郵件）的方式解除契約。依法行使解除權時，無須負擔解約費、處理費或退貨運費。',
        '退貨時，請一併退回主機、隨附配件及文件。僅因必要檢查而拆開包裝，並不因此喪失解除契約的權利。',
      ] },
      { title: '商品瑕疵或寄送錯誤', paragraphs: ['若收到的主機有故障、缺件，或與訂購內容不符，請提供訂單編號及問題說明，聯絡 SGBC。我們將確認問題，並依適用法律提供應有的處理方式。出貨前的測試不影響消費者的上述權利。'] },
      { title: '運送損壞或遺失', paragraphs: ['若包裹送達時已損壞，或疑似遺失，請儘速聯絡 SGBC。請保留包裝，並在可行時提供照片，以協助調查。SGBC 將與物流業者協調並安排適當處理。消費者無須先向物流業者取得賠償，才能向 SGBC 主張權利。'] },
      { title: '消費者造成的損壞', paragraphs: ['因不當使用、交付後的意外損壞或改裝所造成的損壞，不屬於製造瑕疵。任何付費維修均須事先取得消費者同意。此規定不排除與上述行為無關的瑕疵責任，也不限制消費者的法定權利。'] },
    ],
  },
} as const;
