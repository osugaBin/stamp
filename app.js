// PDF多页盖章工具 - 主要JavaScript文件

class PDFStampTool {
  constructor() {
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.0;
    this.stampImage = null;
    this.stamps = {}; // 存储每页的印章 {pageNum: [stamps]}
    this.selectedStamp = null;
    this.selectedPage = null; // 选中印章所在的页码
    this.isDragging = false;
    this.isRotating = false;
    this.dragOffset = { x: 0, y: 0 };
    this.rotateCenter = { x: 0, y: 0 };
    this.rotateStartAngle = 0;
    this.stampType = "normal"; // 印章类型：normal(普通公章) 或 cross(骑缝章)
    this.crossPageStamps = []; // 存储骑缝章的分割片段

    this.initializeElements();
    this.bindEvents();
    this.setupPDFJS();
  }

  initializeElements() {
    this.elements = {
      pdfInput: document.getElementById("pdf-input"),
      stampInput: document.getElementById("stamp-input"),
      pdfName: document.getElementById("pdf-name"),
      stampName: document.getElementById("stamp-name"),
      prevPage: document.getElementById("prev-page"),
      nextPage: document.getElementById("next-page"),
      pageInfo: document.getElementById("page-info"),
      stampSize: document.getElementById("stamp-size"),
      stampRotation: document.getElementById("stamp-rotation"),
      addStamp: document.getElementById("add-stamp"),
      deleteStamp: document.getElementById("delete-stamp"),
      clearStamps: document.getElementById("clear-stamps"),
      stampList: document.getElementById("stamp-list"),
      savePdf: document.getElementById("save-pdf"),
      progressContainer: document.getElementById("progress-container"),
      progressFill: document.getElementById("progress-fill"),
      progressText: document.getElementById("progress-text"),
      pagesWrapper: document.getElementById("pages-wrapper"),
      previewScroll: document.getElementById("preview-scroll"),
      dropZone: document.getElementById("drop-zone"),
      zoomIn: document.getElementById("zoom-in"),
      zoomOut: document.getElementById("zoom-out"),
      zoomLevel: document.getElementById("zoom-level"),
      stampTypeNormal: document.getElementById("stamp-type-normal"),
      stampTypeCross: document.getElementById("stamp-type-cross"),
    };
  }

  setupPDFJS() {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  bindEvents() {
    // 文件上传事件
    if (this.elements.pdfInput) {
      this.elements.pdfInput.addEventListener("change", (e) =>
        this.handlePDFUpload(e)
      );
    }
    if (this.elements.stampInput) {
      this.elements.stampInput.addEventListener("change", (e) =>
        this.handleStampUpload(e)
      );
    }

    // 页面导航事件（滚动到对应页）
    if (this.elements.prevPage) {
      this.elements.prevPage.addEventListener("click", () => this.scrollToPrevPage());
    }
    if (this.elements.nextPage) {
      this.elements.nextPage.addEventListener("click", () => this.scrollToNextPage());
    }

    // 印章操作事件
    if (this.elements.addStamp) {
      this.elements.addStamp.addEventListener("click", () =>
        this.addStampToPage()
      );
    }
    if (this.elements.deleteStamp) {
      this.elements.deleteStamp.addEventListener("click", () =>
        this.deleteSelectedStamp()
      );
    }
    if (this.elements.clearStamps) {
      this.elements.clearStamps.addEventListener("click", () =>
        this.clearCurrentPageStamps()
      );
    }

    // 旋转角度输入事件
    if (this.elements.stampRotation) {
      this.elements.stampRotation.addEventListener("input", () =>
        this.updateSelectedStampRotation()
      );
    }

    // 印章类型切换按钮
    if (this.elements.stampTypeNormal) {
      this.elements.stampTypeNormal.addEventListener("click", () =>
        this.switchStampType("normal")
      );
    }
    if (this.elements.stampTypeCross) {
      this.elements.stampTypeCross.addEventListener("click", () =>
        this.switchStampType("cross")
      );
    }

    // 缩放事件
    if (this.elements.zoomIn) {
      this.elements.zoomIn.addEventListener("click", () => this.zoomIn());
    }
    if (this.elements.zoomOut) {
      this.elements.zoomOut.addEventListener("click", () => this.zoomOut());
    }

    // 保存PDF事件
    if (this.elements.savePdf) {
      this.elements.savePdf.addEventListener("click", () => this.savePDF());
    }

    // 监听滚动以更新当前页
    if (this.elements.previewScroll) {
      this.elements.previewScroll.addEventListener("scroll", () =>
        this.onPreviewScroll()
      );
    }

    // 拖拽上传事件
    this.setupDragAndDrop();

    // 印章交互事件（委托到 pages-wrapper）
    this.setupStampInteraction();
  }

  setupDragAndDrop() {
    const dropZone = this.elements.dropZone;

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove("drag-over");
      });
    });

    dropZone.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === "application/pdf") {
        this.loadPDF(files[0]);
      }
    });
  }

  setupStampInteraction() {
    const wrapper = this.elements.pagesWrapper;

    // mousedown: 开始拖拽/旋转
    wrapper.addEventListener("mousedown", (e) => this.startDrag(e));

    // mousemove: 拖拽/旋转中
    document.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        this.drag(e);
      } else if (this.isRotating) {
        this.rotate(e);
      }
    });

    // mouseup: 结束拖拽/旋转
    document.addEventListener("mouseup", () => {
      this.endDrag();
      this.endRotate();
    });

    // click: 在canvas空白处添加印章
    wrapper.addEventListener("click", (e) => this.handleCanvasClick(e));
  }

  // ============= 印章类型切换 =============
  switchStampType(type) {
    if (type === "normal") {
      this.stampType = "normal";
      this.elements.stampTypeNormal.classList.add("active");
      this.elements.stampTypeCross.classList.remove("active");
      this.elements.addStamp.textContent = "添加印章到当前页";
      // 切换到普通公章时，清除骑缝章
      this.clearCrossPageStamps();
    } else {
      if (!this.stampImage || !this.pdfDoc) {
        alert("请先上传PDF文件和印章图片");
        return;
      }
      this.stampType = "cross";
      this.elements.stampTypeCross.classList.add("active");
      this.elements.stampTypeNormal.classList.remove("active");
      this.elements.addStamp.textContent = "生成骑缝章（所有页）";
      // 生成骑缝章
      this.generateCrossPageStamps();
      this.renderAllStamps();
      this.updateButtonStates();
    }
  }

  // ============= 文件处理 =============
  async handlePDFUpload(event) {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      this.elements.pdfName.textContent = file.name;
      await this.loadPDF(file);
    }
  }

  handleStampUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      this.elements.stampName.textContent = file.name;
      this.loadStampImage(file);
    }
  }

  async loadPDF(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;
      this.stamps = {};
      this.selectedStamp = null;
      this.selectedPage = null;

      this.updatePageInfo();
      this.updateNavigationButtons();
      await this.renderAllPages();

      this.elements.dropZone.classList.add("hidden");
      this.elements.savePdf.disabled = false;
    } catch (error) {
      console.error("PDF加载失败:", error);
      alert("PDF文件加载失败，请检查文件格式");
    }
  }

  loadStampImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.stampImage = new Image();
      this.stampImage.onload = () => {
        const processedCanvas = this.processStampTransparency(this.stampImage);
        const processedImage = new Image();
        processedImage.onload = () => {
          this.stampImage = processedImage;
          this.elements.addStamp.disabled = false;
        };
        processedImage.src = processedCanvas.toDataURL();
      };
      this.stampImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  processStampTransparency(img) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0;
      } else {
        const contrastFactor = 1.3;
        const intercept = 128 * (1 - contrastFactor);
        data[i] = Math.max(0, Math.min(255, r * contrastFactor + intercept));
        data[i + 1] = Math.max(0, Math.min(255, g * contrastFactor + intercept));
        data[i + 2] = Math.max(0, Math.min(255, b * contrastFactor + intercept));

        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const saturationFactor = 2.0;
        data[i] = Math.max(0, Math.min(255, gray + saturationFactor * (data[i] - gray)));
        data[i + 1] = Math.max(0, Math.min(255, gray + saturationFactor * (data[i + 1] - gray)));
        data[i + 2] = Math.max(0, Math.min(255, gray + saturationFactor * (data[i + 2] - gray)));
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  // ============= 渲染全部页面 =============
  async renderAllPages() {
    if (!this.pdfDoc) return;

    const wrapper = this.elements.pagesWrapper;
    wrapper.innerHTML = "";

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      const pageItem = await this.createPageItem(pageNum);
      wrapper.appendChild(pageItem);
    }

    // 渲染所有页的印章
    this.renderAllStamps();
  }

  async createPageItem(pageNum) {
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.scale });

    // 创建页面容器
    const pageItem = document.createElement("div");
    pageItem.className = "page-item";
    pageItem.dataset.page = pageNum;
    pageItem.style.width = viewport.width + "px";
    pageItem.style.height = viewport.height + "px";

    // 页号标签
    const label = document.createElement("div");
    label.className = "page-label";
    label.textContent = `第 ${pageNum} 页`;
    pageItem.appendChild(label);

    // Canvas
    const canvas = document.createElement("canvas");
    canvas.className = "pdf-canvas";
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    canvas.dataset.page = pageNum;

    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    pageItem.appendChild(canvas);

    // 印章覆盖层
    const overlay = document.createElement("div");
    overlay.className = "page-stamp-overlay";
    overlay.dataset.page = pageNum;
    pageItem.appendChild(overlay);

    return pageItem;
  }

  // ============= 印章渲染 =============
  renderAllStamps() {
    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      this.renderPageStamps(pageNum);
    }
    this.updateStampList();
  }

  renderPageStamps(pageNum) {
    const overlay = this.getPageOverlay(pageNum);
    if (!overlay) return;

    overlay.innerHTML = "";
    const pageStamps = this.stamps[pageNum] || [];
    pageStamps.forEach((stamp, index) => {
      this.createStampElement(stamp, index, pageNum, overlay);
    });
  }

  getPageOverlay(pageNum) {
    return this.elements.pagesWrapper.querySelector(
      `.page-stamp-overlay[data-page="${pageNum}"]`
    );
  }

  getPageCanvas(pageNum) {
    return this.elements.pagesWrapper.querySelector(
      `.pdf-canvas[data-page="${pageNum}"]`
    );
  }

  getPageItem(pageNum) {
    return this.elements.pagesWrapper.querySelector(
      `.page-item[data-page="${pageNum}"]`
    );
  }

  createStampElement(stamp, index, pageNum, overlay) {
    const stampElement = document.createElement("div");
    stampElement.className = "stamp";
    stampElement.dataset.index = index;
    stampElement.dataset.page = pageNum;
    stampElement.style.cursor = "move";
    stampElement.style.userSelect = "none";

    if (stamp.isCrossPage && stamp.image) {
      const canvas = document.createElement("canvas");
      canvas.width = stamp.image.width;
      canvas.height = stamp.image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(stamp.image, 0, 0);
      canvas.style.opacity = "0.8";
      canvas.style.mixBlendMode = "multiply";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "none";
      stampElement.appendChild(canvas);
    } else {
      const img = document.createElement("img");
      img.src = stamp.src;
      img.style.opacity = "0.8";
      img.style.mixBlendMode = "multiply";
      img.style.pointerEvents = "none";
      img.style.userSelect = "none";
      img.draggable = false;
      stampElement.appendChild(img);

      const rotateHandle = document.createElement("div");
      rotateHandle.className = "stamp-rotate-handle";
      rotateHandle.title = "拖拽旋转印章（按住Shift以15°吸附）";
      stampElement.appendChild(rotateHandle);
    }

    stampElement.style.left = stamp.x + "px";
    stampElement.style.top = stamp.y + "px";
    stampElement.style.width = stamp.width + "px";
    stampElement.style.height = stamp.height + "px";

    if (stamp.rotation && stamp.rotation !== 0) {
      stampElement.style.transform = `rotate(${stamp.rotation}deg)`;
    }

    stampElement.addEventListener("click", (e) => {
      e.stopPropagation();
      this.selectStamp(index, pageNum);
    });

    stampElement.addEventListener("mouseenter", () => {
      if (!this.isDragging && !this.isRotating) {
        stampElement.style.opacity = "0.9";
        stampElement.style.transition = "all 0.2s ease";
      }
    });

    stampElement.addEventListener("mouseleave", () => {
      if (!this.isDragging && !this.isRotating) {
        stampElement.style.opacity = "0.8";
      }
    });

    overlay.appendChild(stampElement);
  }

  // ============= 添加印章 =============
  addStampToPage() {
    if (!this.stampImage || !this.pdfDoc) return;

    if (this.stampType === "cross") {
      this.clearAllStamps();
      this.generateCrossPageStamps();
      this.renderAllStamps();
      this.updateButtonStates();
      return;
    }

    // 普通公章：添加到当前页
    const canvas = this.getPageCanvas(this.currentPage);
    if (!canvas) return;

    const size = parseFloat(this.elements.stampSize.value);
    const canvasRect = canvas.getBoundingClientRect();
    const stampWidth = canvasRect.width * size;
    const stampHeight = (stampWidth * this.stampImage.height) / this.stampImage.width;

    const x = Math.max(0, Math.min((canvasRect.width - stampWidth) / 2, canvasRect.width - stampWidth));
    const y = Math.max(0, Math.min((canvasRect.height - stampHeight) / 2, canvasRect.height - stampHeight));

    const stamp = {
      src: this.stampImage.src,
      x: x, y: y,
      width: stampWidth, height: stampHeight,
      originalWidth: this.stampImage.width,
      originalHeight: this.stampImage.height,
      rotation: 0,
      isCrossPage: false,
    };

    if (!this.stamps[this.currentPage]) {
      this.stamps[this.currentPage] = [];
    }
    this.stamps[this.currentPage].push(stamp);
    this.renderPageStamps(this.currentPage);
    this.updateButtonStates();
    this.selectStamp(this.stamps[this.currentPage].length - 1, this.currentPage);
  }

  handleCanvasClick(event) {
    if (event.target.closest(".stamp")) return;
    if (!this.stampImage || !this.pdfDoc) return;

    const canvas = event.target.closest(".pdf-canvas");
    if (!canvas) return;

    const pageNum = parseInt(canvas.dataset.page);
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const size = parseFloat(this.elements.stampSize.value);
    const stampWidth = rect.width * size;
    const stampHeight = (stampWidth * this.stampImage.height) / this.stampImage.width;

    const finalX = Math.max(0, Math.min(x - stampWidth / 2, rect.width - stampWidth));
    const finalY = Math.max(0, Math.min(y - stampHeight / 2, rect.height - stampHeight));

    const stamp = {
      src: this.stampImage.src,
      x: finalX, y: finalY,
      width: stampWidth, height: stampHeight,
      originalWidth: this.stampImage.width,
      originalHeight: this.stampImage.height,
      rotation: 0,
    };

    if (!this.stamps[pageNum]) {
      this.stamps[pageNum] = [];
    }
    this.stamps[pageNum].push(stamp);
    this.currentPage = pageNum;
    this.renderPageStamps(pageNum);
    this.updatePageInfo();
    this.updateNavigationButtons();
    this.updateButtonStates();
    this.selectStamp(this.stamps[pageNum].length - 1, pageNum);
  }

  // ============= 拖拽 =============
  startDrag(event) {
    const stampElement = event.target.closest(".stamp");
    if (!stampElement) return;

    const index = parseInt(stampElement.dataset.index);
    const pageNum = parseInt(stampElement.dataset.page);

    if (event.target.closest(".stamp-rotate-handle")) {
      this.startRotate(event, stampElement, index, pageNum);
      return;
    }

    this.isDragging = true;
    this.selectedStamp = index;
    this.selectedPage = pageNum;

    const rect = stampElement.getBoundingClientRect();
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    stampElement.style.opacity = "0.7";
    stampElement.style.transform = "scale(1.1)";
    stampElement.style.zIndex = "1000";
    stampElement.style.transition = "none";
    document.body.style.cursor = "grabbing";

    this.selectStamp(this.selectedStamp, pageNum);
    event.preventDefault();
  }

  drag(event) {
    if (!this.isDragging || this.selectedStamp === null || this.selectedPage === null) return;

    const canvas = this.getPageCanvas(this.selectedPage);
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const stamp = this.stamps[this.selectedPage][this.selectedStamp];

    const newX = event.clientX - canvasRect.left - this.dragOffset.x;
    const newY = event.clientY - canvasRect.top - this.dragOffset.y;

    if (stamp.isCrossPage) {
      const newYPosition = Math.max(0, Math.min(newY, canvasRect.height - stamp.height));
      for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
        const pageStamps = this.stamps[pageNum];
        if (pageStamps) {
          pageStamps.forEach((pageStamp) => {
            if (pageStamp.isCrossPage) {
              pageStamp.y = newYPosition;
            }
          });
        }
      }
    } else {
      stamp.x = Math.max(0, Math.min(newX, canvasRect.width - stamp.width));
      stamp.y = Math.max(0, Math.min(newY, canvasRect.height - stamp.height));
    }

    this.renderAllStamps();
    this.selectStamp(this.selectedStamp, this.selectedPage);
  }

  endDrag() {
    if (this.isDragging && this.selectedStamp !== null) {
      const overlay = this.getPageOverlay(this.selectedPage);
      if (overlay) {
        const stampElements = overlay.querySelectorAll(".stamp");
        const draggedElement = stampElements[this.selectedStamp];
        if (draggedElement) {
          draggedElement.style.opacity = "0.8";
          const stamp = this.stamps[this.selectedPage][this.selectedStamp];
          if (stamp.rotation && stamp.rotation !== 0) {
            draggedElement.style.transform = `rotate(${stamp.rotation}deg)`;
          } else {
            draggedElement.style.transform = "";
          }
          draggedElement.style.zIndex = "auto";
          draggedElement.style.transition = "all 0.2s ease";
        }
      }
      document.body.style.cursor = "auto";
    }
    this.isDragging = false;
  }

  // ============= 旋转 =============
  startRotate(event, stampElement, index, pageNum) {
    this.isRotating = true;
    this.selectedStamp = index;
    this.selectedPage = pageNum;

    const stampRect = stampElement.getBoundingClientRect();
    this.rotateCenter = {
      x: stampRect.left + stampRect.width / 2,
      y: stampRect.top + stampRect.height / 2,
    };

    const stamp = this.stamps[pageNum][index];
    const mouseAngle = Math.atan2(
      event.clientY - this.rotateCenter.y,
      event.clientX - this.rotateCenter.x
    );
    this.rotateStartAngle = (stamp.rotation || 0) - (mouseAngle * 180) / Math.PI;

    stampElement.style.transition = "none";
    stampElement.style.zIndex = "1000";
    document.body.style.cursor = "grabbing";

    this.selectStamp(this.selectedStamp, pageNum);
    event.preventDefault();
    event.stopPropagation();
  }

  rotate(event) {
    if (!this.isRotating || this.selectedStamp === null || this.selectedPage === null) return;

    const stamp = this.stamps[this.selectedPage][this.selectedStamp];
    if (stamp.isCrossPage) return;

    const mouseAngle = Math.atan2(
      event.clientY - this.rotateCenter.y,
      event.clientX - this.rotateCenter.x
    );
    let newRotation = this.rotateStartAngle + (mouseAngle * 180) / Math.PI;

    if (event.shiftKey) {
      newRotation = Math.round(newRotation / 15) * 15;
    }

    stamp.rotation = newRotation;

    const overlay = this.getPageOverlay(this.selectedPage);
    if (overlay) {
      const stampElements = overlay.querySelectorAll(".stamp");
      const el = stampElements[this.selectedStamp];
      if (el) {
        el.style.transform = `rotate(${stamp.rotation}deg)`;
      }
    }
  }

  endRotate() {
    if (this.isRotating && this.selectedStamp !== null) {
      const overlay = this.getPageOverlay(this.selectedPage);
      if (overlay) {
        const stampElements = overlay.querySelectorAll(".stamp");
        const el = stampElements[this.selectedStamp];
        if (el) {
          el.style.transition = "all 0.2s ease";
          el.style.zIndex = "auto";
        }
      }
      document.body.style.cursor = "auto";
    }
    this.isRotating = false;
  }

  // ============= 选择与管理 =============
  selectStamp(index, pageNum) {
    this.selectedStamp = index;
    this.selectedPage = pageNum;
    this.currentPage = pageNum;

    // 清除所有选择
    document.querySelectorAll(".stamp").forEach((el) => {
      el.classList.remove("selected");
    });

    // 设置当前选中的印章
    const overlay = this.getPageOverlay(pageNum);
    if (overlay) {
      const stampElements = overlay.querySelectorAll(".stamp");
      if (stampElements[index]) {
        stampElements[index].classList.add("selected");
      }
    }

    // 同步旋转输入框
    if (this.selectedStamp !== null && this.stamps[pageNum]) {
      const stamp = this.stamps[pageNum][this.selectedStamp];
      if (this.elements.stampRotation) {
        this.elements.stampRotation.value = stamp.rotation || 0;
      }
    }

    this.updatePageInfo();
    this.updateNavigationButtons();
    this.updateStampList();
    this.elements.deleteStamp.disabled = false;
  }

  updateSelectedStampRotation() {
    if (this.selectedStamp === null || this.selectedPage === null) return;
    if (!this.stamps[this.selectedPage]) return;

    const stamp = this.stamps[this.selectedPage][this.selectedStamp];
    if (stamp.isCrossPage) return;

    const newRotation = parseFloat(this.elements.stampRotation.value) || 0;
    stamp.rotation = newRotation;

    const overlay = this.getPageOverlay(this.selectedPage);
    if (overlay) {
      const stampElements = overlay.querySelectorAll(".stamp");
      const el = stampElements[this.selectedStamp];
      if (el) {
        el.style.transform = newRotation !== 0 ? `rotate(${newRotation}deg)` : "";
      }
    }
  }

  deleteSelectedStamp() {
    if (this.selectedStamp === null || this.selectedPage === null) return;
    if (!this.stamps[this.selectedPage]) return;

    const stamp = this.stamps[this.selectedPage][this.selectedStamp];

    // 骑缝章：删除所有页的骑缝章
    if (stamp && stamp.isCrossPage) {
      this.clearCrossPageStamps();
      return;
    }

    this.stamps[this.selectedPage].splice(this.selectedStamp, 1);
    this.selectedStamp = null;
    this.selectedPage = null;
    this.renderAllStamps();
    this.updateButtonStates();
  }

  clearCurrentPageStamps() {
    if (this.stamps[this.currentPage]) {
      this.stamps[this.currentPage] = [];
      this.selectedStamp = null;
      this.selectedPage = null;
      this.renderPageStamps(this.currentPage);
      this.updateStampList();
      this.updateButtonStates();
    }
  }

  clearAllStamps() {
    this.stamps = {};
    this.crossPageStamps = [];
    this.selectedStamp = null;
    this.selectedPage = null;
    this.renderAllStamps();
    this.updateButtonStates();
  }

  clearCrossPageStamps() {
    this.crossPageStamps = [];
    for (let pageNum in this.stamps) {
      this.stamps[pageNum] = this.stamps[pageNum].filter(
        (stamp) => !stamp.isCrossPage
      );
    }
    this.selectedStamp = null;
    this.selectedPage = null;
    this.renderAllStamps();
    this.updateButtonStates();
  }

  // ============= 骑缝章 =============
  generateCrossPageStamps() {
    if (!this.stampImage || !this.totalPages) return;

    this.crossPageStamps = this.splitStampImage(this.stampImage, this.totalPages);
    this.addCrossPageStampsToPages();
  }

  splitStampImage(stampImg, pageCount) {
    const stampWidth = stampImg.width;
    const stampHeight = stampImg.height;
    const segmentWidth = stampWidth / pageCount;
    const segments = [];

    for (let i = 0; i < pageCount; i++) {
      const segmentCanvas = document.createElement("canvas");
      const segmentCtx = segmentCanvas.getContext("2d");
      segmentCanvas.width = segmentWidth;
      segmentCanvas.height = stampHeight;
      segmentCtx.drawImage(
        stampImg,
        i * segmentWidth, 0,
        segmentWidth, stampHeight,
        0, 0,
        segmentWidth, stampHeight
      );
      segments.push(segmentCanvas);
    }
    return segments;
  }

  addCrossPageStampsToPages() {
    if (!this.crossPageStamps.length) return;

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      if (!this.stamps[pageNum]) {
        this.stamps[pageNum] = [];
      }

      const segmentIndex = pageNum - 1;
      if (segmentIndex < this.crossPageStamps.length) {
        const segment = this.crossPageStamps[segmentIndex];

        // 使用第一页的canvas尺寸作为参考（所有页相同尺寸）
        const canvas = this.getPageCanvas(1);
        if (!canvas) continue;
        const canvasRect = canvas.getBoundingClientRect();
        const stampSize = parseFloat(this.elements.stampSize.value);
        const stampWidth = (canvasRect.width * stampSize) / this.totalPages;
        const stampHeight = (stampWidth * segment.height) / segment.width;

        const stamp = {
          x: canvasRect.width - stampWidth,
          y: (canvasRect.height - stampHeight) / 2,
          width: stampWidth,
          height: stampHeight,
          image: segment,
          isCrossPage: true,
          rotation: 0,
          segmentIndex: segmentIndex,
        };

        this.stamps[pageNum].push(stamp);
      }
    }
  }

  // ============= 导航与滚动 =============
  scrollToPrevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.scrollToPage(this.currentPage);
    }
  }

  scrollToNextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.scrollToPage(this.currentPage);
    }
  }

  scrollToPage(pageNum) {
    const pageItem = this.getPageItem(pageNum);
    if (pageItem && this.elements.previewScroll) {
      const containerRect = this.elements.previewScroll.getBoundingClientRect();
      const itemRect = pageItem.getBoundingClientRect();
      const scrollTop =
        this.elements.previewScroll.scrollTop +
        (itemRect.top - containerRect.top) -
        20;
      this.elements.previewScroll.scrollTo({
        top: scrollTop,
        behavior: "smooth",
      });
    }
    this.updatePageInfo();
    this.updateNavigationButtons();
  }

  onPreviewScroll() {
    // 根据滚动位置判断当前在查看哪一页
    const container = this.elements.previewScroll;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerMid = containerRect.top + containerRect.height / 2;

    let closestPage = 1;
    let closestDist = Infinity;

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      const pageItem = this.getPageItem(pageNum);
      if (!pageItem) continue;

      const rect = pageItem.getBoundingClientRect();
      const pageMid = rect.top + rect.height / 2;
      const dist = Math.abs(pageMid - containerMid);

      if (dist < closestDist) {
        closestDist = dist;
        closestPage = pageNum;
      }
    }

    if (closestPage !== this.currentPage) {
      this.currentPage = closestPage;
      this.updatePageInfo();
      this.updateNavigationButtons();
      this.updateStampList();
    }
  }

  // ============= 缩放 =============
  zoomIn() {
    this.scale = Math.min(this.scale * 1.2, 3.0);
    this.updateZoomLevel();
    this.rerenderAfterZoom();
  }

  zoomOut() {
    this.scale = Math.max(this.scale / 1.2, 0.5);
    this.updateZoomLevel();
    this.rerenderAfterZoom();
  }

  async rerenderAfterZoom() {
    if (!this.pdfDoc) return;

    this.selectedStamp = null;
    this.selectedPage = null;

    // 记录当前滚动位置比例
    const container = this.elements.previewScroll;
    const scrollRatio = container
      ? container.scrollTop / (container.scrollHeight - container.clientHeight || 1)
      : 0;

    await this.renderAllPages();

    // 恢复滚动位置
    if (container) {
      container.scrollTop = scrollRatio * (container.scrollHeight - container.clientHeight);
    }

    this.updateButtonStates();
  }

  updateZoomLevel() {
    this.elements.zoomLevel.textContent = Math.round(this.scale * 100) + "%";
  }

  // ============= UI 更新 =============
  updatePageInfo() {
    this.elements.pageInfo.textContent = `${this.currentPage} / ${this.totalPages}`;
  }

  updateNavigationButtons() {
    this.elements.prevPage.disabled = this.currentPage <= 1;
    this.elements.nextPage.disabled = this.currentPage >= this.totalPages;
  }

  updateStampList() {
    const list = this.elements.stampList;
    list.innerHTML = "";

    const pageStamps = this.stamps[this.currentPage] || [];
    pageStamps.forEach((stamp, index) => {
      const li = document.createElement("li");
      const typeLabel = stamp.isCrossPage ? "骑缝章" : "印章";
      li.textContent = `${typeLabel} ${index + 1}`;
      li.addEventListener("click", () => this.selectStamp(index, this.currentPage));
      if (this.selectedStamp === index && this.selectedPage === this.currentPage) {
        li.classList.add("selected");
      }
      list.appendChild(li);
    });
  }

  updateButtonStates() {
    const hasStamps =
      this.stamps[this.currentPage] && this.stamps[this.currentPage].length > 0;
    this.elements.clearStamps.disabled = !hasStamps;
    this.elements.deleteStamp.disabled = this.selectedStamp === null;
  }

  // ============= 保存PDF =============
  async savePDF() {
    if (!this.pdfDoc) return;

    this.showProgress(true);
    this.updateProgress(0, "开始处理PDF...");

    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF();
      pdf.deletePage(1);

      for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
        this.updateProgress(
          ((pageNum - 1) / this.totalPages) * 100,
          `处理第 ${pageNum} 页...`
        );

        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // 获取预览canvas尺寸用于缩放比例计算
        const previewPageItem = this.getPageItem(pageNum);
        const previewCanvas = previewPageItem
          ? previewPageItem.querySelector(".pdf-canvas")
          : null;
        const previewWidth = previewCanvas
          ? previewCanvas.getBoundingClientRect().width
          : viewport.width / 2;

        const scaleRatio = viewport.width / (previewWidth || 1);

        const pageStamps = this.stamps[pageNum] || [];
        for (const stamp of pageStamps) {
          let imageSource;

          if (stamp.isCrossPage && stamp.image) {
            imageSource = stamp.image;
          } else {
            imageSource = new Image();
            imageSource.src = stamp.src;
            await new Promise((resolve) => {
              imageSource.onload = resolve;
            });
          }

          const stampX = stamp.x * scaleRatio;
          const stampY = stamp.y * scaleRatio;
          const stampWidth = stamp.width * scaleRatio;
          const stampHeight = stamp.height * scaleRatio;

          const finalX = Math.max(0, Math.min(stampX, viewport.width - stampWidth));
          const finalY = Math.max(0, Math.min(stampY, viewport.height - stampHeight));
          const finalWidth = Math.min(stampWidth, viewport.width - finalX);
          const finalHeight = Math.min(stampHeight, viewport.height - finalY);

          const centerX = finalX + finalWidth / 2;
          const centerY = finalY + finalHeight / 2;

          context.globalAlpha = 0.8;
          context.globalCompositeOperation = "multiply";

          if (stamp.rotation && stamp.rotation !== 0 && !stamp.isCrossPage) {
            context.save();
            context.translate(centerX, centerY);
            context.rotate((stamp.rotation * Math.PI) / 180);
            context.drawImage(imageSource, -finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight);
            context.restore();
          } else {
            context.drawImage(imageSource, finalX, finalY, finalWidth, finalHeight);
          }

          context.globalCompositeOperation = "source-over";
          context.globalAlpha = 1.0;
        }

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addPage([pdfWidth, pdfHeight]);
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }

      this.updateProgress(100, "生成PDF文件...");

      const fileName =
        this.elements.pdfName.textContent.replace(".pdf", "") + "_stamped.pdf";
      pdf.save(fileName);

      this.updateProgress(100, "完成！");
      setTimeout(() => this.showProgress(false), 2000);
    } catch (error) {
      console.error("PDF保存失败:", error);
      alert("PDF保存失败，请重试");
      this.showProgress(false);
    }
  }

  showProgress(show) {
    this.elements.progressContainer.style.display = show ? "block" : "none";
    this.elements.savePdf.disabled = show;
  }

  updateProgress(percent, text) {
    this.elements.progressFill.style.width = percent + "%";
    this.elements.progressText.textContent = text;
  }
}

// 初始化应用
document.addEventListener("DOMContentLoaded", () => {
  new PDFStampTool();
});
