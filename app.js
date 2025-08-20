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
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.stampType = "normal"; // 印章类型：normal(普通公章) 或 cross-page(骑缝章)
    this.crossPageStamps = []; // 存储骑缝章的分割片段

    this.initializeElements();
    this.bindEvents();
    this.setupPDFJS();
  }

  initializeElements() {
    // 获取DOM元素
    this.elements = {
      pdfInput: document.getElementById("pdf-input"),
      stampInput: document.getElementById("stamp-input"),
      pdfName: document.getElementById("pdf-name"),
      stampName: document.getElementById("stamp-name"),
      prevPage: document.getElementById("prev-page"),
      nextPage: document.getElementById("next-page"),
      pageInfo: document.getElementById("page-info"),
      stampSize: document.getElementById("stamp-size"),
      addStamp: document.getElementById("add-stamp"),
      deleteStamp: document.getElementById("delete-stamp"),
      clearStamps: document.getElementById("clear-stamps"),
      stampList: document.getElementById("stamp-list"),
      savePdf: document.getElementById("save-pdf"),
      progressContainer: document.getElementById("progress-container"),
      progressFill: document.getElementById("progress-fill"),
      progressText: document.getElementById("progress-text"),
      canvas: document.getElementById("pdf-canvas"),
      stampOverlay: document.getElementById("stamp-overlay"),
      dropZone: document.getElementById("drop-zone"),
      zoomIn: document.getElementById("zoom-in"),
      zoomOut: document.getElementById("zoom-out"),
      zoomLevel: document.getElementById("zoom-level"),
      stampTypeNormal: document.getElementById("stamp-type-normal"),
      stampTypeCross: document.getElementById("stamp-type-cross"),
    };
  }

  setupPDFJS() {
    // 设置PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  bindEvents() {
    // 文件上传事件
    this.elements.pdfInput.addEventListener("change", (e) =>
      this.handlePDFUpload(e)
    );
    this.elements.stampInput.addEventListener("change", (e) =>
      this.handleStampUpload(e)
    );

    // 页面导航事件
    this.elements.prevPage.addEventListener("click", () => this.previousPage());
    this.elements.nextPage.addEventListener("click", () => this.nextPage());

    // 印章操作事件
    this.elements.addStamp.addEventListener("click", () =>
      this.addStampToPage()
    );
    this.elements.deleteStamp.addEventListener("click", () =>
      this.deleteSelectedStamp()
    );
    this.elements.clearStamps.addEventListener("click", () =>
      this.clearCurrentPageStamps()
    );

    // 缩放事件
    this.elements.zoomIn.addEventListener("click", () => this.zoomIn());
    this.elements.zoomOut.addEventListener("click", () => this.zoomOut());

    // 保存PDF事件
    this.elements.savePdf.addEventListener("click", () => this.savePDF());

    // 印章类型切换事件
    this.elements.stampTypeNormal.addEventListener("change", () => {
      if (this.elements.stampTypeNormal.checked) {
        this.stampType = "normal";
        // 切换到普通公章模式时，清除骑缝章但保留普通公章
        this.clearCrossPageStamps();
      }
    });
    this.elements.stampTypeCross.addEventListener("change", () => {
      if (this.elements.stampTypeCross.checked) {
        this.stampType = "cross-page";
        // 切换到骑缝章模式时，保留现有普通公章
        this.generateCrossPageStamps();
      }
    });

    // 拖拽上传事件
    this.setupDragAndDrop();

    // 画布点击事件
    this.elements.canvas.addEventListener("click", (e) =>
      this.handleCanvasClick(e)
    );

    // 印章拖拽事件
    this.setupStampDragging();
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

  setupStampDragging() {
    this.elements.stampOverlay.addEventListener("mousedown", (e) =>
      this.startDrag(e)
    );
    document.addEventListener("mousemove", (e) => this.drag(e));
    document.addEventListener("mouseup", () => this.endDrag());
  }

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
      this.stamps = {}; // 重置印章数据

      this.updatePageInfo();
      this.updateNavigationButtons();
      await this.renderPage();

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
        // 处理印章透明背景
        const processedCanvas = this.processStampTransparency(this.stampImage);
        // 创建新的图片对象使用处理后的数据
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

  // 处理印章图片透明背景
  processStampTransparency(img) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 将白色背景设为透明并增强对比度和饱和度
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 检测白色或接近白色的像素
      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0; // 设为透明
      } else {
        // 增强对比度 (contrast factor: 1.3)
        const contrastFactor = 1.3;
        const intercept = 128 * (1 - contrastFactor);

        data[i] = Math.max(0, Math.min(255, r * contrastFactor + intercept));
        data[i + 1] = Math.max(
          0,
          Math.min(255, g * contrastFactor + intercept)
        );
        data[i + 2] = Math.max(
          0,
          Math.min(255, b * contrastFactor + intercept)
        );

        // 增强饱和度
        const gray =
          0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const saturationFactor = 2.0;

        data[i] = Math.max(
          0,
          Math.min(255, gray + saturationFactor * (data[i] - gray))
        );
        data[i + 1] = Math.max(
          0,
          Math.min(255, gray + saturationFactor * (data[i + 1] - gray))
        );
        data[i + 2] = Math.max(
          0,
          Math.min(255, gray + saturationFactor * (data[i + 2] - gray))
        );
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  async renderPage() {
    if (!this.pdfDoc) return;

    try {
      const page = await this.pdfDoc.getPage(this.currentPage);
      const viewport = page.getViewport({ scale: this.scale });

      this.elements.canvas.width = viewport.width;
      this.elements.canvas.height = viewport.height;

      // 设置画布样式以确保左对齐
      this.elements.canvas.style.width = viewport.width + "px";
      this.elements.canvas.style.height = viewport.height + "px";

      const context = this.elements.canvas.getContext("2d");
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // 更新印章覆盖层尺寸和位置，确保与PDF画布完全对齐
      this.elements.stampOverlay.style.width = viewport.width + "px";
      this.elements.stampOverlay.style.height = viewport.height + "px";
      this.elements.stampOverlay.style.left = "20px"; // 对应容器的padding
      this.elements.stampOverlay.style.top = "20px"; // 对应容器的padding

      // 渲染当前页的印章
      this.renderStamps();
    } catch (error) {
      console.error("页面渲染失败:", error);
    }
  }

  renderStamps() {
    // 清空现有印章
    this.elements.stampOverlay.innerHTML = "";

    const pageStamps = this.stamps[this.currentPage] || [];
    pageStamps.forEach((stamp, index) => {
      this.createStampElement(stamp, index);
    });

    this.updateStampList();
  }

  createStampElement(stamp, index) {
    const stampElement = document.createElement("div");
    stampElement.className = "stamp";
    stampElement.dataset.index = index;

    if (stamp.isCrossPage && stamp.image) {
      // 骑缝章：使用canvas图像
      const canvas = document.createElement("canvas");
      canvas.width = stamp.image.width;
      canvas.height = stamp.image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(stamp.image, 0, 0);
      canvas.style.opacity = "0.8";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      stampElement.appendChild(canvas);
    } else {
      // 普通公章：使用img元素
      const img = document.createElement("img");
      img.src = stamp.src;
      img.style.opacity = "0.8";
      stampElement.appendChild(img);
    }

    stampElement.style.left = stamp.x + "px";
    stampElement.style.top = stamp.y + "px";
    stampElement.style.width = stamp.width + "px";
    stampElement.style.height = stamp.height + "px";

    stampElement.addEventListener("click", (e) => {
      e.stopPropagation();
      this.selectStamp(index);
    });

    this.elements.stampOverlay.appendChild(stampElement);
  }

  addStampToPage() {
    if (!this.stampImage || !this.pdfDoc) return;

    if (this.stampType === "cross") {
      // 骑缝章模式：清空现有印章并生成骑缝章
      this.clearAllStamps();
      this.generateCrossPageStamps();
    } else {
      // 普通公章模式：在当前页面添加印章
      const size = parseFloat(this.elements.stampSize.value);
      const canvasRect = this.elements.canvas.getBoundingClientRect();
      const stampWidth = canvasRect.width * size;
      const stampHeight =
        (stampWidth * this.stampImage.height) / this.stampImage.width;

      // 计算居中位置
      const x = Math.max(
        0,
        Math.min(
          (canvasRect.width - stampWidth) / 2,
          canvasRect.width - stampWidth
        )
      );
      const y = Math.max(
        0,
        Math.min(
          (canvasRect.height - stampHeight) / 2,
          canvasRect.height - stampHeight
        )
      );

      const stamp = {
        src: this.stampImage.src,
        x: x,
        y: y,
        width: stampWidth,
        height: stampHeight,
        originalWidth: this.stampImage.width,
        originalHeight: this.stampImage.height,
        isCrossPage: false,
      };

      if (!this.stamps[this.currentPage]) {
        this.stamps[this.currentPage] = [];
      }

      this.stamps[this.currentPage].push(stamp);
      this.renderStamps();
      this.updateButtonStates();
    }
  }

  handleCanvasClick(event) {
    if (!this.stampImage || !this.pdfDoc) return;

    const rect = this.elements.canvas.getBoundingClientRect();
    // 获取PDF容器的padding偏移
    const containerRect =
      this.elements.canvas.parentElement.getBoundingClientRect();
    const containerPadding = 20; // 对应CSS中的padding: 20px

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const size = parseFloat(this.elements.stampSize.value);
    const stampWidth = rect.width * size;
    const stampHeight =
      (stampWidth * this.stampImage.height) / this.stampImage.width;

    // 边界检查
    const finalX = Math.max(
      0,
      Math.min(x - stampWidth / 2, rect.width - stampWidth)
    );
    const finalY = Math.max(
      0,
      Math.min(y - stampHeight / 2, rect.height - stampHeight)
    );

    const stamp = {
      src: this.stampImage.src,
      x: finalX,
      y: finalY,
      width: stampWidth,
      height: stampHeight,
      originalWidth: this.stampImage.width,
      originalHeight: this.stampImage.height,
    };

    if (!this.stamps[this.currentPage]) {
      this.stamps[this.currentPage] = [];
    }

    this.stamps[this.currentPage].push(stamp);
    this.renderStamps();
    this.updateButtonStates();
  }

  startDrag(event) {
    const stampElement = event.target.closest(".stamp");
    if (!stampElement) return;

    this.isDragging = true;
    this.selectedStamp = parseInt(stampElement.dataset.index);

    const rect = stampElement.getBoundingClientRect();
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    this.selectStamp(this.selectedStamp);
    event.preventDefault();
  }

  drag(event) {
    if (!this.isDragging || this.selectedStamp === null) return;

    const canvasRect = this.elements.canvas.getBoundingClientRect();
    const stamp = this.stamps[this.currentPage][this.selectedStamp];

    const newX = event.clientX - canvasRect.left - this.dragOffset.x;
    const newY = event.clientY - canvasRect.top - this.dragOffset.y;

    if (stamp.isCrossPage) {
      // 骑缝章：只允许垂直移动，并同步所有页面的骑缝章位置
      const newYPosition = Math.max(
        0,
        Math.min(newY, canvasRect.height - stamp.height)
      );

      // 同步更新所有页面的骑缝章位置
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
      // x坐标保持不变（固定在右边）
    } else {
      // 普通公章：允许自由移动
      stamp.x = Math.max(0, Math.min(newX, canvasRect.width - stamp.width));
      stamp.y = Math.max(0, Math.min(newY, canvasRect.height - stamp.height));
    }

    this.renderStamps();
    this.selectStamp(this.selectedStamp);
  }

  endDrag() {
    this.isDragging = false;
  }

  selectStamp(index) {
    this.selectedStamp = index;

    // 更新视觉选择状态
    document.querySelectorAll(".stamp").forEach((el, i) => {
      el.classList.toggle("selected", i === index);
    });

    // 更新印章列表选择状态
    document.querySelectorAll(".stamp-list li").forEach((el, i) => {
      el.classList.toggle("selected", i === index);
    });

    this.elements.deleteStamp.disabled = false;
  }

  deleteSelectedStamp() {
    if (this.selectedStamp === null || !this.stamps[this.currentPage]) return;

    this.stamps[this.currentPage].splice(this.selectedStamp, 1);
    this.selectedStamp = null;
    this.renderStamps();
    this.updateButtonStates();
  }

  clearCurrentPageStamps() {
    if (this.stamps[this.currentPage]) {
      this.stamps[this.currentPage] = [];
      this.selectedStamp = null;
      this.renderStamps();
      this.updateButtonStates();
    }
  }

  // 清空所有页面的印章
  clearAllStamps() {
    this.stamps = {};
    this.crossPageStamps = [];
    this.selectedStamp = null;
    this.renderStamps();
    this.updateButtonStates();
  }

  // 只清除骑缝章，保留普通公章
  clearCrossPageStamps() {
    // 清空骑缝章数组
    this.crossPageStamps = [];

    // 遍历所有页面，只移除骑缝章
    for (let pageNum in this.stamps) {
      this.stamps[pageNum] = this.stamps[pageNum].filter(
        (stamp) => !stamp.isCrossPage
      );
    }

    this.selectedStamp = null;
    this.renderStamps();
    this.updateButtonStates();
  }

  // 生成骑缝章分割片段
  generateCrossPageStamps() {
    if (!this.stampImage || !this.totalPages) return;

    this.crossPageStamps = this.splitStampImage(
      this.stampImage,
      this.totalPages
    );
    this.addCrossPageStampsToPages();
  }

  // 分割印章图片
  splitStampImage(stampImg, pageCount) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const stampWidth = stampImg.width;
    const stampHeight = stampImg.height;
    const segmentWidth = stampWidth / pageCount;

    const segments = [];

    for (let i = 0; i < pageCount; i++) {
      const segmentCanvas = document.createElement("canvas");
      const segmentCtx = segmentCanvas.getContext("2d");

      segmentCanvas.width = segmentWidth;
      segmentCanvas.height = stampHeight;

      // 绘制当前片段
      segmentCtx.drawImage(
        stampImg,
        i * segmentWidth,
        0,
        segmentWidth,
        stampHeight,
        0,
        0,
        segmentWidth,
        stampHeight
      );

      segments.push(segmentCanvas);
    }

    return segments;
  }

  // 将骑缝章片段添加到各页面
  addCrossPageStampsToPages() {
    if (!this.crossPageStamps.length) return;

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      if (!this.stamps[pageNum]) {
        this.stamps[pageNum] = [];
      }

      const segmentIndex = pageNum - 1;
      if (segmentIndex < this.crossPageStamps.length) {
        const segment = this.crossPageStamps[segmentIndex];

        // 计算印章在页面右边的位置
        const canvasRect = this.elements.canvas.getBoundingClientRect();
        const stampSize = parseFloat(this.elements.stampSize.value);
        // 使用与普通公章相同的比例计算方式
        const stampWidth = (canvasRect.width * stampSize) / this.totalPages;
        const stampHeight = (stampWidth * segment.height) / segment.width;

        const stamp = {
          x: canvasRect.width - stampWidth, // 右边顶格，不留边距
          y: (canvasRect.height - stampHeight) / 2, // 默认放在页面中间
          width: stampWidth,
          height: stampHeight,
          image: segment,
          isCrossPage: true,
          segmentIndex: segmentIndex,
        };

        this.stamps[pageNum].push(stamp);
      }
    }

    this.renderStamps();
    this.updateButtonStates();
  }

  updateStampList() {
    const list = this.elements.stampList;
    list.innerHTML = "";

    const pageStamps = this.stamps[this.currentPage] || [];
    pageStamps.forEach((stamp, index) => {
      const li = document.createElement("li");
      li.textContent = `印章 ${index + 1}`;
      li.addEventListener("click", () => this.selectStamp(index));
      list.appendChild(li);
    });
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.selectedStamp = null;
      this.updatePageInfo();
      this.updateNavigationButtons();
      this.renderPage();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.selectedStamp = null;
      this.updatePageInfo();
      this.updateNavigationButtons();
      this.renderPage();
    }
  }

  zoomIn() {
    this.scale = Math.min(this.scale * 1.2, 3.0);
    this.updateZoomLevel();
    this.renderPage();
  }

  zoomOut() {
    this.scale = Math.max(this.scale / 1.2, 0.5);
    this.updateZoomLevel();
    this.renderPage();
  }

  updateZoomLevel() {
    this.elements.zoomLevel.textContent = Math.round(this.scale * 100) + "%";
  }

  updatePageInfo() {
    this.elements.pageInfo.textContent = `${this.currentPage} / ${this.totalPages}`;
  }

  updateNavigationButtons() {
    this.elements.prevPage.disabled = this.currentPage <= 1;
    this.elements.nextPage.disabled = this.currentPage >= this.totalPages;
  }

  updateButtonStates() {
    const hasStamps =
      this.stamps[this.currentPage] && this.stamps[this.currentPage].length > 0;
    this.elements.clearStamps.disabled = !hasStamps;
    this.elements.deleteStamp.disabled = this.selectedStamp === null;
  }

  async savePDF() {
    if (!this.pdfDoc) return;

    this.showProgress(true);
    this.updateProgress(0, "开始处理PDF...");

    try {
      // 使用jsPDF创建新的PDF
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF();

      // 删除默认页面
      pdf.deletePage(1);

      for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
        this.updateProgress(
          ((pageNum - 1) / this.totalPages) * 100,
          `处理第 ${pageNum} 页...`
        );

        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // 高分辨率

        // 创建临时画布
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");

        // 渲染PDF页面
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // 添加印章
        const pageStamps = this.stamps[pageNum] || [];
        for (const stamp of pageStamps) {
          let imageSource;

          if (stamp.isCrossPage && stamp.image) {
            // 骑缝章：直接使用canvas图像
            imageSource = stamp.image;
          } else {
            // 普通公章：创建img元素
            imageSource = new Image();
            imageSource.src = stamp.src;
            await new Promise((resolve) => {
              imageSource.onload = resolve;
            });
          }

          // 计算印章在高分辨率画布上的位置和尺寸
          const scaleRatio = viewport.width / (this.elements.canvas.width || 1);
          const stampX = stamp.x * scaleRatio;
          const stampY = stamp.y * scaleRatio;
          const stampWidth = stamp.width * scaleRatio;
          const stampHeight = stamp.height * scaleRatio;

          // 边界检查
          const finalX = Math.max(
            0,
            Math.min(stampX, viewport.width - stampWidth)
          );
          const finalY = Math.max(
            0,
            Math.min(stampY, viewport.height - stampHeight)
          );
          const finalWidth = Math.min(stampWidth, viewport.width - finalX);
          const finalHeight = Math.min(stampHeight, viewport.height - finalY);

          // 设置透明度并绘制印章
          context.globalAlpha = 0.8;
          context.drawImage(
            imageSource,
            finalX,
            finalY,
            finalWidth,
            finalHeight
          );
          context.globalAlpha = 1.0;
        }

        // 将画布添加到PDF
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const pdfWidth = 210; // A4宽度(mm)
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addPage([pdfWidth, pdfHeight]);
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }

      this.updateProgress(100, "生成PDF文件...");

      // 保存PDF
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
