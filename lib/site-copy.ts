import type { ConsoleView } from '@/app/console-scene';

export type Locale = 'en' | 'zh-TW';
export const languageStorageKey = 'sgbc-language';

const en = {
  meta: {
    title: 'SGBC — A new home for your classics.',
    description: 'Meet SGBC. An FPGA console designed around original Game Boy, Game Boy Color, and Game Boy Advance cartridges. Explore the Rev C design in three dimensions.',
  },
  skip: 'Skip to content',
  home: 'SGBC home',
  nav: { label: 'Main navigation', console: 'Console', design: 'Design', specs: 'Specs' },
  preorder: {
    button: 'Preorder', eyebrow: 'SGBC / COMING SOON', title: 'Preorders', subtitle: 'opening soon.',
    description: 'We’re getting SGBC ready for its next chapter. Pricing and availability will be announced when preorders open.',
    close: 'Back to the console',
  },
  hero: {
    eyebrow: 'INDEPENDENT HARDWARE / FAMILIAR FEELING', revision: 'FPGA CONSOLE — REV C',
    title: 'Old soul.', subtitle: 'New hardware.',
    intro: ['Your cartridges. Your big screen.', 'An FPGA console for the games', ' that never left you.'],
    explore: 'Explore the hardware', label: 'THE CONSOLE', study: 'ENCLOSURE STUDY / 001',
  },
  story: {
    eyebrow: 'BUILT AROUND THE RITUAL', title: 'Keep the cartridges.', lead: 'Change the ', accent: 'possibilities.',
    alt: 'Three floating Game Boy and Game Boy Color cartridges with translucent clear, blue, and Bordeaux shells.',
    description: 'The click of a cartridge. A controller you know by heart. SGBC brings programmable hardware to a console designed around three generations of handheld classics.',
    systems: 'Intended cartridge families',
  },
  design: {
    eyebrow: '02 / THE OBJECT', colors: 'CLASSIC GRAY. BLACK. BORDEAUX.',
    title: 'Every angle.', subtitle: 'Every detail.', intro: 'A look at the enclosure study.', detail: 'From the outside, in.',
    angles: 'Console viewing angle', study: 'ENCLOSURE / ASSEMBLY STUDY', drag: 'DRAG TO ROTATE', reset: 'Reset detail view',
    gray: 'Gray', black: 'Black', bordeaux: 'Bordeaux',
  },
  views: [
    { id: 'hero', label: 'Overview', title: 'A familiar shape.\nIts own character.', description: 'Warm gray up top. Black underneath. Bordeaux on the details you touch. A compact home for the cartridges you kept.' },
    { id: 'top', label: 'Top', title: 'The ritual\nstarts here.', description: 'An upright cartridge slot, dedicated power and reset buttons, and a clean top surface. Simple things, given room to breathe.' },
    { id: 'rear', label: 'Connections', title: 'Meet your\nbig screen.', description: 'Explore the HDMI and USB-C openings in the enclosure study. A familiar controller connection brings the setup together.' },
    { id: 'inside', label: 'Cutaway', title: 'Take the\nroof off.', description: 'Look through the earlier enclosure assembly: cartridge carrier, controls, and motherboard placement.' },
  ] as { id: ConsoleView; label: string; title: string; description: string }[],
  specs: {
    eyebrow: '03 / THE PARTICULARS', title: 'Small footprint.', subtitle: 'Real hardware.', revision: 'REV C / IN DEVELOPMENT',
    rows: [
      ['FPGA', 'Efinix T85F324C3'],
      ['Cartridge interface', 'Game Boy / Game Boy Color / Game Boy Advance'],
      ['HDMI transmitter', 'ITE IT6263FN/BX'],
      ['Memory', '40 MiB PSRAM'],
      ['USB-C', '5 V power + FT232H JTAG programming'],
      ['Controller / storage', 'SNES connector / microSD'],
      ['Motherboard', '130 × 95 mm / 6 layers'],
      ['Enclosure study', '148 × 105.75 mm / 39.5 mm cartridge crest'],
    ],
    note: 'An independent engineering prototype. Hardware integration, game compatibility, and final specifications are still being validated. Console renders show the earlier enclosure assembly.',
  },
  closing: { eyebrow: 'A NEW HOME FOR YOUR CLASSICS.', title: 'Still game.', project: 'SGBC / AN INDEPENDENT PROJECT', tagline: 'BUILT FOR THE GAMES THAT STAY.' },
  footer: { trademarks: 'Game Boy, Game Boy Color, and Game Boy Advance are trademarks of Nintendo.', independent: 'SGBC is an independent project and is not affiliated with Nintendo.', top: 'BACK TO TOP' },
  viewer: {
    console: 'Interactive SGBC console: drag with a mouse or one finger, or use arrow keys to rotate.',
    pcb: 'Interactive SGBC Rev C IT6263 motherboard: drag with a mouse or one finger, or use arrow keys to rotate.',
    alt: 'SGBC console with a classic gray shell, black base, and solid Bordeaux controls.',
    loading: 'Bringing the details into view', errorTitle: 'Meet SGBC.', error: 'The 3D view couldn’t load. You can explore the console details below.', retry: 'Try again',
  },
};

const zhTW: typeof en = {
  meta: {
    title: 'SGBC — 經典遊戲的新歸宿。',
    description: '認識 SGBC：為原版 Game Boy、Game Boy Color 與 Game Boy Advance 卡帶打造的 FPGA 主機。透過 3D 模型探索 Rev C 設計。',
  },
  skip: '跳至主要內容',
  home: 'SGBC 首頁',
  nav: { label: '主要導覽', console: '主機', design: '設計', specs: '規格' },
  preorder: {
    button: '預購', eyebrow: 'SGBC / 即將登場', title: '預購', subtitle: '即將開放。',
    description: 'SGBC 正準備迎接下一個階段。售價與供貨資訊將於開放預購時公布。', close: '返回主機介紹',
  },
  hero: {
    eyebrow: '獨立打造 / 熟悉的感動', revision: 'FPGA 主機 — REV C',
    title: '經典靈魂。', subtitle: '全新硬體。',
    intro: ['你的卡帶，你的大螢幕。', '一台 FPGA 主機，', '讓念念不忘的遊戲再次登場。'],
    explore: '探索硬體', label: '主機本體', study: '外殼設計 / 001',
  },
  story: {
    eyebrow: '為熟悉的遊戲儀式而生', title: '留下卡帶。', lead: '玩出', accent: '全新可能。',
    alt: '三片懸浮的 Game Boy 與 Game Boy Color 卡帶，分別採用透明、藍色與酒紅色半透明外殼。',
    description: '插入卡帶的喀噠聲，握在手中再熟悉不過的控制器。SGBC 以可程式化硬體，為三個世代的掌上型遊戲經典打造專屬主機。',
    systems: '預計支援的卡帶系列',
  },
  design: {
    eyebrow: '02 / 外觀設計', colors: '經典灰、黑、酒紅。',
    title: '每個角度。', subtitle: '每處細節。', intro: '探索外殼設計。', detail: '從外觀，到內部。',
    angles: '主機檢視角度', study: '外殼 / 組裝設計', drag: '拖曳以旋轉', reset: '重設檢視角度',
    gray: '灰色', black: '黑色', bordeaux: '酒紅色',
  },
  views: [
    { id: 'hero', label: '總覽', title: '熟悉的輪廓。\n獨有的個性。', description: '上蓋採用暖灰色，底座搭配黑色，經常觸碰的細節則以酒紅色點綴。為珍藏的卡帶，打造小巧的新歸宿。' },
    { id: 'top', label: '頂部', title: '熟悉的儀式，\n從這裡開始。', description: '直立式卡帶插槽、獨立的電源與重設按鈕，以及簡潔的頂部設計。讓每個日常操作，都有恰到好處的空間。' },
    { id: 'rear', label: '連接埠', title: '經典遊戲，\n登上大螢幕。', description: '查看外殼設計中的 HDMI 與 USB-C 開孔，再接上熟悉的控制器，完成你的遊戲配置。' },
    { id: 'inside', label: '剖面', title: '打開上蓋，\n看看裡面。', description: '查看早期外殼組裝模型中的卡帶承載座、控制元件與主機板配置。' },
  ],
  specs: {
    eyebrow: '03 / 硬體規格', title: '小巧機身。', subtitle: '真實硬體。', revision: 'REV C / 開發中',
    rows: [
      ['FPGA', 'Efinix T85F324C3'],
      ['卡帶介面', 'Game Boy / Game Boy Color / Game Boy Advance'],
      ['HDMI 傳送晶片', 'ITE IT6263FN/BX'],
      ['記憶體', '40 MiB PSRAM'],
      ['USB-C', '5 V 供電 + FT232H JTAG 燒錄'],
      ['控制器 / 儲存裝置', 'SNES 接頭 / microSD'],
      ['主機板', '130 × 95 mm / 6 層板'],
      ['外殼設計', '148 × 105.75 mm / 卡帶插槽頂部高度 39.5 mm'],
    ],
    note: '本產品為獨立開發的工程原型。硬體整合、遊戲相容性與最終規格仍在驗證中。主機渲染圖呈現的是早期外殼組裝設計。',
  },
  closing: { eyebrow: '為經典遊戲，找到新歸宿。', title: '繼續玩。', project: 'SGBC / 獨立開發計畫', tagline: '為始終留在心中的遊戲而生。' },
  footer: { trademarks: 'Game Boy、Game Boy Color 與 Game Boy Advance 為任天堂的商標。', independent: 'SGBC 為獨立開發計畫，與任天堂無關。', top: '回到頂部' },
  viewer: {
    console: 'SGBC 互動式主機模型：以滑鼠或單指拖曳，或使用方向鍵旋轉。',
    pcb: 'SGBC Rev C IT6263 互動式主機板模型：以滑鼠或單指拖曳，或使用方向鍵旋轉。',
    alt: 'SGBC 主機，搭配經典灰色上蓋、黑色底座與純色酒紅控制按鈕。',
    loading: '正在載入模型細節', errorTitle: '認識 SGBC。', error: '無法載入 3D 模型。你仍可瀏覽下方的主機介紹。', retry: '重試',
  },
};

export const siteCopy = { en, 'zh-TW': zhTW };
