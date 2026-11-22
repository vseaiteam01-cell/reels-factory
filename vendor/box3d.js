// Коробка товара настоящим рендером: шесть граней, свет, отражение, тень.
// Плоский CSS-куб читался как картон, потому что на нём не было ни одного
// блика. Здесь материал глянцевый, свет идёт с трёх сторон, под коробкой
// лежит мягкая тень, а рёбра подсвечены тонкой линией — так предмет
// перестаёт быть рисунком.
import * as THREE from "./three.module.min.js";

const ЛАЙМ = 0xb6ff3c;
const ФИОЛЕТ = 0x7b3bff;

export function поставить(узел, опции = {}) {
  const тихо = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return null;                      // без WebGL остаётся запасная вёрстка
  }
  const W = () => узел.clientWidth || 600;
  const H = () => узел.clientHeight || 520;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W(), H());
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  узел.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const сцена = new THREE.Scene();
  const камера = new THREE.PerspectiveCamera(30, W() / H(), 0.1, 100);
  камера.position.set(0, 0.18, 3.55);

  // Окружение: мягкий градиент, из которого и берутся отражения на глянце.
  const небо = document.createElement("canvas");
  небо.width = 16; небо.height = 256;
  const к = небо.getContext("2d");
  const г = к.createLinearGradient(0, 0, 0, 256);
  г.addColorStop(0.0, "#2b1d5c");
  г.addColorStop(0.45, "#17132a");
  г.addColorStop(1.0, "#07060d");
  к.fillStyle = г; к.fillRect(0, 0, 16, 256);
  const окружение = new THREE.CanvasTexture(небо);
  окружение.mapping = THREE.EquirectangularReflectionMapping;
  окружение.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  сцена.environment = pmrem.fromEquirectangular(окружение).texture;

  const ключ = new THREE.DirectionalLight(0xffffff, 2.9);
  ключ.position.set(1.9, 2.8, 4.4);
  ключ.castShadow = false;
  ключ.shadow.mapSize.set(2048, 2048);
  ключ.shadow.camera.near = 0.5;
  ключ.shadow.camera.far = 12;
  // карта вдвое плотнее и радиус шире: при 1024 и радиусе 5 тень ложилась
  // резким клином, предмет читался как наклейка на фоне
  ключ.shadow.radius = 11;
  ключ.shadow.bias = -0.0012;
  сцена.add(ключ);
  сцена.add(new THREE.HemisphereLight(0x8a6bff, 0x05040a, 1.1));
  const фронт = new THREE.DirectionalLight(0xd9d2ff, 0.85);   // снимает провал на лице
  фронт.position.set(-0.8, 0.6, 3.0);
  сцена.add(фронт);
  const контровой = new THREE.PointLight(ЛАЙМ, 13, 12, 2);
  контровой.position.set(-2.2, 1.4, -2.0);
  сцена.add(контровой);
  const подсветка = new THREE.PointLight(ФИОЛЕТ, 7, 12, 2);
  подсветка.position.set(2.4, -0.8, 1.6);
  сцена.add(подсветка);

  const загрузчик = new THREE.TextureLoader();
  // Кадр рисуется не только в цикле: во вкладке, которую браузер считает
  // фоновой, requestAnimationFrame не вызывается, и без прямого рендера
  // по готовности текстур на месте коробки остаётся чёрный прямоугольник.
  let готово = false;
  const нарисовать = () => { if (готово) renderer.render(сцена, камера); };
  const текстура = (путь) => {
    const t = загрузчик.load(путь, нарисовать);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const лицо = опции.лицо || "media/box-face.jpg";
  const бок = опции.бок || "media/box-side.jpg";
  const верх = опции.верх || "media/box-top.jpg";

  const общее = { roughness: 0.42, metalness: 0.0, clearcoat: 0.5,
                  clearcoatRoughness: 0.32, envMapIntensity: 1.0 };
  const тёмный = new THREE.MeshPhysicalMaterial({ color: 0x0b0914, ...общее });
  const материалы = [
    new THREE.MeshPhysicalMaterial({ map: текстура(бок), ...общее }),   // +X
    new THREE.MeshPhysicalMaterial({ map: текстура(бок), ...общее }),   // -X
    new THREE.MeshPhysicalMaterial({ map: текстура(верх), ...общее }),  // +Y
    тёмный,                                                            // -Y
    new THREE.MeshPhysicalMaterial({ map: текстура(лицо), ...общее }),  // +Z
    тёмный,                                                            // -Z
  ];

  const Ш = 1.0, В = 1.37, Г = 0.42;
  const коробка = new THREE.Mesh(new THREE.BoxGeometry(Ш, В, Г), материалы);
  коробка.castShadow = true;
  сцена.add(коробка);

  // Тонкая линия по рёбрам: фаска, которой у голого куба нет.
  const рёбра = new THREE.LineSegments(
    new THREE.EdgesGeometry(коробка.geometry),
    new THREE.LineBasicMaterial({ color: 0xede9ff, transparent: true, opacity: 0.16 }));
  коробка.add(рёбра);


  // Контактная тень: мягкое пятно прямо под основанием. Без неё коробка
  // висит в воздухе, с одной направленной тенью — лежит плашмя.
  const пятно = document.createElement("canvas");
  пятно.width = пятно.height = 256;
  const кисть = пятно.getContext("2d");
  const град = кисть.createRadialGradient(128, 128, 4, 128, 128, 126);
  град.addColorStop(0.0, "rgba(0,0,0,0.62)");
  град.addColorStop(0.45, "rgba(0,0,0,0.26)");
  град.addColorStop(1.0, "rgba(0,0,0,0)");
  кисть.fillStyle = град;
  кисть.fillRect(0, 0, 256, 256);
  const контакт = new THREE.Mesh(
    new THREE.PlaneGeometry(Ш * 2.4, Г * 4.2),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(пятно),
      transparent: true, depthWrite: false, opacity: 0.85 }));
  контакт.rotation.x = -Math.PI / 2;
  контакт.position.set(0, -В / 2 - 0.02, Г * 0.30);
  контакт.renderOrder = -1;
  сцена.add(контакт);

  let целевойY = -0.42, целевойX = -0.12, текущийY = -0.9, текущийX = 0.0;
  const сцена_узел = опции.сцена || узел;

  function навести(e) {
    const r = сцена_узел.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width - 0.5;
    const v = (e.clientY - r.top) / r.height - 0.5;
    целевойY = -0.42 + u * 1.1;
    целевойX = -0.12 + v * 0.5;
  }
  if (!тихо) {
    сцена_узел.addEventListener("pointermove", навести);
    сцена_узел.addEventListener("pointerleave", () => { целевойY = -0.42; целевойX = -0.12; });
  }

  function размер() {
    камера.aspect = W() / H();
    камера.updateProjectionMatrix();
    renderer.setSize(W(), H());
    // setSize чистит буфер. Во вкладке, которая сейчас не на экране, кадры
    // не идут, и место коробки остаётся пустым: запасная вёрстка уже снята.
    // Поэтому рисуем сразу, не дожидаясь очереди кадров.
    if (готово) renderer.render(сцена, камера);
  }
  // Слушать окно мало: колонка меняет ширину и без изменения окна, и тогда
  // холст остаётся шире места, а предмет уезжает из кадра.
  if ("ResizeObserver" in window) new ResizeObserver(размер).observe(узел);
  window.addEventListener("resize", размер);
  размер();

  let видно = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((зз) => { видно = зз[0].isIntersecting; },
      { rootMargin: "120px" }).observe(узел);
  }

  готово = true;
  renderer.render(сцена, камера);

  const t0 = performance.now();
  function кадр(t) {
    requestAnimationFrame(кадр);
    if (!видно) return;
    const плавно = тихо ? 1 : 0.08;
    текущийY += (целевойY - текущийY) * плавно;
    текущийX += (целевойX - текущийX) * плавно;
    коробка.rotation.y = текущийY + (тихо ? 0 : Math.sin((t - t0) / 4200) * 0.07);
    коробка.rotation.x = текущийX;
    коробка.position.y = тихо ? 0 : Math.sin((t - t0) / 2600) * 0.035;
    renderer.render(сцена, камера);
  }
  requestAnimationFrame(кадр);
  return { коробка, renderer };
}
