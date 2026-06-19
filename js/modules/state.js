// ================================================================
// state.js — Все DOM-переменные и состояние приложения
// ================================================================

// Шапка
export const versionSpan        = document.getElementById('logo-version');
export const powerBtn           = document.getElementById('power-btn');
export const mainContent        = document.querySelector('main');

// Навигация
export const navItems           = document.querySelectorAll('.m3-nav-item[data-tab]');
export const pages              = document.querySelectorAll('[data-page]');

// Темная тема
export const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Анимация
export const effectSelector     = document.getElementById('effect-selector');
export const animSpeedContainer = document.getElementById('anim-speed-container');
export const softstartContainer = document.getElementById('softstart-container');

// Статус и настройки
export const wifiBtn            = document.getElementById('wifi-status');
export const powerToggle        = document.getElementById('power-toggle');
export const powerToggleText    = document.getElementById('power-toggle-text');
export const rgbSelector        = document.getElementById('rgb-selector');
export const COLOR_TYPE_MAP     = ['RGB', 'RBG', 'GRB', 'GBR', 'BRG', 'BGR'];
export const channelsForm       = document.getElementById('channels-qty-form');
export const channelsRadios     = document.querySelectorAll('md-radio[name="group"]');

// Слайдеры
export const animSlider         = document.getElementById('animation-speed-slider');
export const softSlider         = document.getElementById('softstart-speed-slider');
export const brightSlider       = document.getElementById('max-brightness-slider');
export const m3Sliders          = ['animation-speed', 'softstart-speed', 'max-brightness'];
export const getUnit            = (id) => id.includes('brightness') ? ' %' : ' мс';

// Поля размеров
export const lengthInput        = document.getElementById('length-field');
export const widthInput         = document.getElementById('width-field');
export const stepInput          = document.getElementById('step-field');
export const saveDimensionsBtn  = document.getElementById('save-dimensions-btn');
export const extraDimsContainer = document.getElementById('extra-dims-container');
export const extraDimsFields    = document.getElementById('extra-dims-fields');

// Выбор эскиза
export const drawPickerLabel    = document.getElementById('draw-picker-label');
export const drawList           = document.getElementById('draw-list');
export const loader             = document.getElementById('app-loader');

// Изменяемое состояние
export let effectsMap       = {};
export let drawsMap         = [];
export let selectedDrawId   = 'draw-01';
export let isSaved          = false;
export let channelsQty      = 2;

// Сеттеры для изменяемого состояния
export function setEffectsMap(val)    { effectsMap    = val; }
export function setDrawsMap(val)      { drawsMap      = val; }
export function setSelectedDrawId(val){ selectedDrawId = val; }
export function setIsSaved(val)       { isSaved       = val; }
export function setChannelsQty(val)   { channelsQty   = val; }


