import os
import io
import tempfile
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageTk
from PyPDF2 import PdfReader, PdfWriter
from pdf2image import convert_from_path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def add_stamp_to_pdf(pdf_path, stamp_path, output_path, position=(0, 0), size=1.0):
    """将印章图片添加到PDF指定位置（保持原始像素，仅按比例调整显示尺寸）"""
    temp_pdf_path = None
    
    try:
        # 获取原始印章图像尺寸（不加载像素数据，仅获取元信息）
        with Image.open(stamp_path) as stamp_img:
            original_width = stamp_img.width
            original_height = stamp_img.height
        
        # 计算显示尺寸（原始尺寸×比例，不修改像素）
        draw_width = int(original_width * size)
        draw_height = int(original_height * size)
        
        # 创建临时PDF文件存储印章
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf_file:
            temp_pdf_path = temp_pdf_file.name
            
            # 获取原始PDF的页面尺寸
            pdf_reader = PdfReader(pdf_path)
            page = pdf_reader.pages[0]
            page_width = float(page.mediabox.width)
            page_height = float(page.mediabox.height)
            
            # 绘制印章（使用原始图像，仅指定显示尺寸）
            c = canvas.Canvas(temp_pdf_path, pagesize=(page_width, page_height))
            x = position[0] - (draw_width / 2)  # 居中对齐
            y = position[1] - (draw_height / 2)
            # 关键：drawImage使用原始图像路径，通过width/height控制显示大小（不改变像素）
            c.drawImage(stamp_path, x, y, 
                       width=draw_width, height=draw_height, mask='auto')
            c.save()
        
        # 合并印章到PDF
        pdf_reader = PdfReader(pdf_path)
        stamp_reader = PdfReader(temp_pdf_path)
        pdf_writer = PdfWriter()
        
        stamp_page = stamp_reader.pages[0]
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            page.merge_page(stamp_page)
            pdf_writer.add_page(page)
        
        with open(output_path, "wb") as f:
            pdf_writer.write(f)
        
        return True
        
    except Exception as e:
        print(f"添加印章时出错: {str(e)}")
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
            except:
                pass
        raise e
    finally:
        # 清理临时文件
        try:
            if temp_pdf_path and os.path.exists(temp_pdf_path):
                os.remove(temp_pdf_path)
        except Exception as e:
            print(f"清理临时文件时出错: {str(e)}")

class StampApp:
    def __init__(self, root):
        self.root = root
        self.root.title("PDF多页盖章工具（保持原始像素）")
        self.root.geometry("900x950")
        
        # 窗口居中显示
        self.center_window()
        
        # 初始化变量
        self.pdf_path = ""
        self.stamp_path = ""
        self.output_path = ""
        self.stamp_img = None  # 预览用缩放图像
        self.original_stamp_img = None  # 原始印章图像（保留像素）
        self.original_stamp_width = 0  # 原始印章宽度
        self.original_stamp_height = 0  # 原始印章高度
        self.default_scale = 0.2  # 默认缩放比例
        self.dragging = False
        
        # 多页PDF相关变量
        self.pdf_pages = []  # 存储所有页面的图片
        self.current_page = 0  # 当前显示的页面索引
        self.total_pages = 0  # 总页数
        self.page_stamps = {}  # 存储每页的印章信息 {page_num: [(position, size), ...]}
        self.selected_stamp_id = None  # 当前选中的印章ID
        
        # 预览相关变量
        self.pdf_photo = None
        self.preview_height = 0
        self.preview_width = 0
        
        # 创建UI
        self.create_widgets()
    
    def center_window(self):
        """将窗口居中显示"""
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f"{width}x{height}+{x}+{y}")
    
    def create_widgets(self):
        # 主框架布局（与原逻辑一致，略去重复代码）
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 顶部控制区域
        control_frame = ttk.Frame(main_frame)
        control_frame.pack(fill=tk.X, pady=5)
        
        # 文件选择按钮
        btn_frame = ttk.Frame(control_frame)
        btn_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(btn_frame, text="选择PDF文件", command=self.select_pdf).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="选择印章图片", command=self.select_stamp).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="保存盖章PDF", command=self.save_pdf).pack(side=tk.LEFT, padx=5)
        
        # 页面导航控制
        nav_frame = ttk.Frame(control_frame)
        nav_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(nav_frame, text="上一页", command=self.prev_page).pack(side=tk.LEFT, padx=5)
        ttk.Button(nav_frame, text="下一页", command=self.next_page).pack(side=tk.LEFT, padx=5)
        
        self.page_label = ttk.Label(nav_frame, text="页面: 0/0")
        self.page_label.pack(side=tk.LEFT, padx=10)
        
        # 印章控制区域
        stamp_frame = ttk.Frame(control_frame)
        stamp_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(stamp_frame, text="印章大小(0.01-1.0):").pack(side=tk.LEFT)
        self.size_entry = ttk.Entry(stamp_frame, width=5)
        self.size_entry.insert(0, str(self.default_scale))
        self.size_entry.pack(side=tk.LEFT, padx=5)
        
        # 绑定大小输入框的实时预览
        self.size_entry.bind('<KeyRelease>', self.on_size_change)
        self.size_entry.bind('<FocusOut>', self.on_size_change)
        
        ttk.Button(stamp_frame, text="添加印章", command=self.add_stamp_to_current_page).pack(side=tk.LEFT, padx=5)
        ttk.Button(stamp_frame, text="删除选中印章", command=self.delete_selected_stamp).pack(side=tk.LEFT, padx=5)
        ttk.Button(stamp_frame, text="清空当前页印章", command=self.clear_current_page_stamps).pack(side=tk.LEFT, padx=5)
        
        # 左侧预览画布 + 右侧印章列表（布局与原逻辑一致）
        content_frame = ttk.Frame(main_frame)
        content_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        
        canvas_frame = ttk.Frame(content_frame)
        canvas_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        self.canvas = tk.Canvas(canvas_frame, width=600, height=800, bg='white', bd=2, relief=tk.SUNKEN)
        self.canvas.pack(fill=tk.BOTH, expand=True)
        self.canvas.bind("<Button-1>", self.on_canvas_click)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<ButtonRelease-1>", self.stop_drag)
        
        list_frame = ttk.Frame(content_frame, width=200)
        list_frame.pack(side=tk.RIGHT, fill=tk.Y)
        list_frame.pack_propagate(False)
        
        ttk.Label(list_frame, text="当前页印章列表:").pack(pady=5)
        
        listbox_frame = ttk.Frame(list_frame)
        listbox_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.stamp_listbox = tk.Listbox(listbox_frame, height=15)
        scrollbar = ttk.Scrollbar(listbox_frame, orient=tk.VERTICAL, command=self.stamp_listbox.yview)
        self.stamp_listbox.config(yscrollcommand=scrollbar.set)
        
        self.stamp_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.stamp_listbox.bind("<<ListboxSelect>>", self.on_stamp_select)
    
    def select_pdf(self):
        self.pdf_path = filedialog.askopenfilename(
            title="选择PDF文件", 
            filetypes=[("PDF文件", "*.pdf")]
        )
        if self.pdf_path:
            self.load_pdf_pages()
            self.current_page = 0
            self.page_stamps = {}
            self.update_page_display()
            self.update_stamp_list()
    
    def select_stamp(self):
        self.stamp_path = filedialog.askopenfilename(
            title="选择印章图片", 
            filetypes=[("图片文件", "*.png *.jpg *.jpeg")]
        )
        if self.stamp_path:
            self.load_stamp()  # 加载原始图像并保存
    
    def load_stamp(self):
        """加载印章图像（同时保存原始图像和预览用缩放图像）"""
        try:
            # 保存原始图像（保留完整像素数据）
            self.original_stamp_img = Image.open(self.stamp_path).convert("RGBA")
            self.original_stamp_width = self.original_stamp_img.width
            self.original_stamp_height = self.original_stamp_img.height
            
            # 处理透明度和颜色（仅用于预览，不修改原始图像）
            preview_img = self.original_stamp_img.copy()
            datas = preview_img.getdata()
            new_data = []
            for item in datas:
                # 白色背景透明化
                if item[0] > 230 and item[1] > 230 and item[2] > 230:
                    new_data.append((255, 255, 255, 0))
                # 灰色阴影透明化
                elif item[0] > 180 and item[1] > 180 and item[2] > 180:
                    new_data.append((255, 255, 255, 0))
                # 印章内容增强
                else:
                    color_intensity = 255 - ((item[0] + item[1] + item[2]) / 3)
                    alpha = min(255, int(color_intensity * 2.0 * 0.7))
                    new_data.append((255, 30, 30, alpha))  # 鲜艳红色带透明度
            
            preview_img.putdata(new_data)
            self.stamp_img = preview_img  # 预览用图像
            self.update_stamp_display()  # 更新预览显示
        except Exception as e:
            messagebox.showerror("错误", f"加载印章图片失败: {str(e)}")
    
    def load_pdf_pages(self):
        """加载PDF所有页面（与原逻辑一致）"""
        try:
            self.pdf_pages = convert_from_path(self.pdf_path, dpi=72)
            self.total_pages = len(self.pdf_pages)
            messagebox.showinfo("成功", f"已加载PDF文件，共{self.total_pages}页")
        except Exception as e:
            messagebox.showerror("错误", f"加载PDF失败: {str(e)}")
            self.pdf_pages = []
            self.total_pages = 0
    
    def update_page_display(self):
        """更新当前页面显示（与原逻辑一致）"""
        if not self.pdf_pages:
            return
            
        self.canvas.delete("all")
        self.page_label.config(text=f"页面: {self.current_page + 1}/{self.total_pages}")
        
        if 0 <= self.current_page < len(self.pdf_pages):
            img = self.pdf_pages[self.current_page]
            max_width = self.canvas.winfo_width() or 600
            max_height = self.canvas.winfo_height() or 800
            
            self.original_preview_width = img.width
            self.original_preview_height = img.height
            
            img.thumbnail((max_width, max_height))
            self.pdf_photo = ImageTk.PhotoImage(img)
            
            self.preview_width = self.pdf_photo.width()
            self.preview_height = self.pdf_photo.height()
            
            self.canvas.create_image(0, 0, image=self.pdf_photo, anchor=tk.NW)
            self.show_current_page_stamps()
    
    def prev_page(self):
        if self.current_page > 0:
            self.current_page -= 1
            self.update_page_display()
            self.update_stamp_list()
    
    def next_page(self):
        if self.current_page < self.total_pages - 1:
            self.current_page += 1
            self.update_page_display()
            self.update_stamp_list()
    
    def add_stamp_to_current_page(self):
        """添加印章到当前页（使用原始尺寸计算）"""
        if not self.stamp_path:
            messagebox.showerror("错误", "请先选择印章图片")
            return
        if not self.pdf_pages:
            messagebox.showerror("错误", "请先选择PDF文件")
            return
        
        try:
            size = float(self.size_entry.get())
            if not (0.01 <= size <= 1.0):
                messagebox.showerror("错误", "请输入0.01到1.0之间的数值")
                return
        except ValueError:
            messagebox.showerror("错误", "请输入有效的数字")
            return
        
        # 页面中心添加印章
        center_x = self.preview_width // 2
        center_y = self.preview_height // 2
        
        if self.current_page not in self.page_stamps:
            self.page_stamps[self.current_page] = []
        
        stamp_info = {
            'position': (center_x, center_y),
            'size': size,
            'id': len(self.page_stamps[self.current_page])
        }
        
        self.page_stamps[self.current_page].append(stamp_info)
        self.show_current_page_stamps()
        self.update_stamp_list()
    
    def delete_selected_stamp(self):
        """删除选中的印章（与原逻辑一致）"""
        if self.selected_stamp_id is None:
            messagebox.showwarning("提示", "请先选择要删除的印章")
            return
        
        if self.current_page in self.page_stamps:
            stamps = self.page_stamps[self.current_page]
            self.page_stamps[self.current_page] = [s for s in stamps if s['id'] != self.selected_stamp_id]
            
            # 重新分配ID
            for i, stamp in enumerate(self.page_stamps[self.current_page]):
                stamp['id'] = i
            
            self.selected_stamp_id = None
            self.show_current_page_stamps()
            self.update_stamp_list()
    
    def clear_current_page_stamps(self):
        """清空当前页印章（与原逻辑一致）"""
        if self.current_page in self.page_stamps:
            del self.page_stamps[self.current_page]
            self.selected_stamp_id = None
            self.show_current_page_stamps()
            self.update_stamp_list()
    
    def update_stamp_list(self):
        """更新印章列表（与原逻辑一致）"""
        self.stamp_listbox.delete(0, tk.END)
        if self.current_page in self.page_stamps:
            for i, stamp in enumerate(self.page_stamps[self.current_page]):
                pos = stamp['position']
                size = stamp['size']
                self.stamp_listbox.insert(tk.END, f"印章{i+1}: ({pos[0]:.0f},{pos[1]:.0f}) 大小:{size:.2f}")
    
    def on_stamp_select(self, event):
        """选择印章列表项（与原逻辑一致）"""
        selection = self.stamp_listbox.curselection()
        if selection:
            self.selected_stamp_id = selection[0]
            if self.current_page in self.page_stamps:
                stamps = self.page_stamps[self.current_page]
                if self.selected_stamp_id < len(stamps):
                    selected_stamp = stamps[self.selected_stamp_id]
                    self.size_entry.delete(0, tk.END)
                    self.size_entry.insert(0, str(selected_stamp['size']))
            self.show_current_page_stamps()
    
    def show_current_page_stamps(self):
        """显示当前页印章（预览用缩放，不影响原始像素）"""
        self.canvas.delete("stamp")
        self.canvas.delete("selected_stamp")
        
        if hasattr(self, 'stamp_photos'):
            self.stamp_photos.clear()
        else:
            self.stamp_photos = []
        
        if self.current_page not in self.page_stamps or not self.stamp_img:
            return
        
        for stamp in self.page_stamps[self.current_page]:
            pos = stamp['position']
            size = stamp['size']
            
            # 预览时缩放（仅为显示，原始图像不变）
            preview_width = int(self.original_stamp_width * size)
            preview_height = int(self.original_stamp_height * size)
            resized = self.stamp_img.resize((preview_width, preview_height), Image.LANCZOS)
            stamp_photo = ImageTk.PhotoImage(resized)
            
            # 标记选中状态
            tag = "stamp"
            if stamp['id'] == self.selected_stamp_id:
                tag = "selected_stamp"
                self.canvas.create_rectangle(
                    pos[0] - preview_width//2 - 2, pos[1] - preview_height//2 - 2,
                    pos[0] + preview_width//2 + 2, pos[1] + preview_height//2 + 2,
                    outline="red", width=2, tags="selected_stamp"
                )
            
            self.canvas.create_image(
                pos[0], pos[1], 
                image=stamp_photo, 
                anchor=tk.CENTER, 
                tags=tag
            )
            self.stamp_photos.append(stamp_photo)
    
    def on_size_change(self, event=None):
        """更新印章大小（仅影响预览和显示尺寸计算）"""
        try:
            size = float(self.size_entry.get())
            if 0.01 <= size <= 1.0:
                self.default_scale = size
                if (self.selected_stamp_id is not None and 
                    self.current_page in self.page_stamps):
                    for stamp in self.page_stamps[self.current_page]:
                        if stamp['id'] == self.selected_stamp_id:
                            stamp['size'] = size
                            break
                    self.show_current_page_stamps()
                    self.update_stamp_list()
        except ValueError:
            pass
    
    def update_stamp_display(self):
        """更新印章预览（仅缩放显示，原始图像不变）"""
        if self.stamp_img:
            preview_width = int(self.original_stamp_width * self.default_scale)
            preview_height = int(self.original_stamp_height * self.default_scale)
            resized = self.stamp_img.resize((preview_width, preview_height), Image.LANCZOS)
            self.stamp_photo = ImageTk.PhotoImage(resized)
    
    def on_canvas_click(self, event):
        """画布点击事件（与原逻辑一致）"""
        if not self.stamp_img or not self.pdf_pages:
            return
        
        x, y = event.x, event.y
        clicked_stamp = None
        
        if self.current_page in self.page_stamps:
            for stamp in self.page_stamps[self.current_page]:
                pos = stamp['position']
                size = stamp['size']
                width = int(self.original_stamp_width * size)
                height = int(self.original_stamp_height * size)
                
                if (abs(x - pos[0]) <= width // 2 and 
                    abs(y - pos[1]) <= height // 2):
                    clicked_stamp = stamp
                    break
        
        if clicked_stamp:
            self.selected_stamp_id = clicked_stamp['id']
            self.stamp_listbox.selection_clear(0, tk.END)
            self.stamp_listbox.selection_set(clicked_stamp['id'])
            self.size_entry.delete(0, tk.END)
            self.size_entry.insert(0, str(clicked_stamp['size']))
            self.show_current_page_stamps()
        else:
            try:
                size = float(self.size_entry.get())
                if not (0.01 <= size <= 1.0):
                    messagebox.showerror("错误", "请输入0.01到1.0之间的数值")
                    return
            except ValueError:
                messagebox.showerror("错误", "请输入有效的数字")
                return
            
            if self.current_page not in self.page_stamps:
                self.page_stamps[self.current_page] = []
            
            # 边界检查：确保新添加的印章不超出预览区域
            stamp_width = int(self.original_stamp_width * size)
            stamp_height = int(self.original_stamp_height * size)
            half_width = stamp_width // 2
            half_height = stamp_height // 2
            
            # 限制X坐标范围
            if x - half_width < 0:
                x = half_width
            elif x + half_width > self.preview_width:
                x = self.preview_width - half_width
                
            # 限制Y坐标范围
            if y - half_height < 0:
                y = half_height
            elif y + half_height > self.preview_height:
                y = self.preview_height - half_height
            
            stamp_info = {
                'position': (x, y),
                'size': size,
                'id': len(self.page_stamps[self.current_page])
            }
            
            self.page_stamps[self.current_page].append(stamp_info)
            self.show_current_page_stamps()
            self.update_stamp_list()
    
    def on_drag(self, event):
        """拖拽印章（添加边界检查）"""
        if self.selected_stamp_id is not None and self.current_page in self.page_stamps:
            for stamp in self.page_stamps[self.current_page]:
                if stamp['id'] == self.selected_stamp_id:
                    # 获取印章尺寸
                    size = stamp['size']
                    stamp_width = int(self.original_stamp_width * size)
                    stamp_height = int(self.original_stamp_height * size)
                    
                    # 边界检查：确保印章不超出预览区域
                    x = event.x
                    y = event.y
                    half_width = stamp_width // 2
                    half_height = stamp_height // 2
                    
                    # 限制X坐标范围
                    if x - half_width < 0:
                        x = half_width
                    elif x + half_width > self.preview_width:
                        x = self.preview_width - half_width
                        
                    # 限制Y坐标范围
                    if y - half_height < 0:
                        y = half_height
                    elif y + half_height > self.preview_height:
                        y = self.preview_height - half_height
                    
                    stamp['position'] = (x, y)
                    break
            
            self.show_current_page_stamps()
            self.update_stamp_list()
            self.canvas.update_idletasks()
    
    def stop_drag(self, event):
        pass
    
    def save_pdf(self):
        """保存盖章后的PDF（核心改进：使用原始印章像素）"""
        if not self.pdf_path:
            messagebox.showerror("错误", "请先选择PDF文件")
            return
        if not self.stamp_path:
            messagebox.showerror("错误", "请先选择印章图片")
            return
        if not self.page_stamps:
            messagebox.showwarning("提示", "没有添加任何印章")
            return
        
        base_name = os.path.splitext(os.path.basename(self.pdf_path))[0]
        default_name = f"{base_name}_stamped.pdf"
        
        self.output_path = filedialog.asksaveasfilename(
            title="保存盖章后的PDF",
            initialfile=default_name,
            defaultextension=".pdf",
            filetypes=[("PDF文件", "*.pdf")]
        )
        
        if self.output_path:
            try:
                progress = ttk.Progressbar(self.root, mode="indeterminate")
                progress.pack(pady=5, fill=tk.X, padx=10)
                progress.start()
                self.root.after(100, lambda: self._save_pdf_async(progress))
            except Exception as e:
                progress.stop()
                progress.destroy()
                messagebox.showerror("错误", f"发生错误: {str(e)}")
    
    def _save_pdf_async(self, progress):
        """异步保存PDF（关键改进：使用原始印章尺寸计算显示大小）"""
        try:
            pdf_reader = PdfReader(self.pdf_path)
            pdf_writer = PdfWriter()
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                page_width = float(page.mediabox.width)
                page_height = float(page.mediabox.height)
                
                if page_num in self.page_stamps:
                    # 计算PDF与预览的尺寸比例（用于坐标转换）
                    preview_width = self.preview_width
                    preview_height = self.preview_height
                    ratio_x = page_width / preview_width
                    ratio_y = page_height / preview_height
                    
                    # 为当前页的每个印章创建临时PDF
                    for stamp in self.page_stamps[page_num]:
                        pos = stamp['position']
                        size = stamp['size']
                        
                        # 转换坐标（预览坐标→PDF实际坐标）
                        x = pos[0] * ratio_x
                        y = page_height - (pos[1] * ratio_y)  # 翻转Y轴
                        
                        # 计算显示尺寸（原始印章尺寸×比例，不修改像素）
                        draw_width = self.original_stamp_width * size
                        draw_height = self.original_stamp_height * size
                        
                        # 边界检查：确保印章不超出页面范围
                        half_width = draw_width / 2
                        half_height = draw_height / 2
                        
                        # 限制X坐标范围
                        if x - half_width < 0:
                            x = half_width
                        elif x + half_width > page_width:
                            x = page_width - half_width
                            
                        # 限制Y坐标范围
                        if y - half_height < 0:
                            y = half_height
                        elif y + half_height > page_height:
                            y = page_height - half_height
                        
                        # 创建临时印章PDF（使用原始图像）
                        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                            temp_pdf_path = temp_pdf.name
                            
                            # 处理印章透明度（直接使用原始图像处理后的数据）
                            processed_stamp = self.original_stamp_img.copy()
                            datas = processed_stamp.getdata()
                            new_data = []
                            for item in datas:
                                if item[0] > 230 and item[1] > 230 and item[2] > 230:
                                    new_data.append((255, 255, 255, 0))
                                elif item[0] > 180 and item[1] > 180 and item[2] > 180:
                                    new_data.append((255, 255, 255, 0))
                                else:
                                    color_intensity = 255 - ((item[0] + item[1] + item[2]) / 3)
                                    alpha = min(255, int(color_intensity * 2.0 * 0.7))
                                    new_data.append((255, 30, 30, alpha))
                            
                            processed_stamp.putdata(new_data)
                            
                            # 保存原始尺寸的处理后印章（不缩放）
                            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_img:
                                processed_stamp.save(temp_img, format='PNG', dpi=(300, 300))
                                temp_img_path = temp_img.name
                            
                            # 绘制印章（使用原始尺寸图像，指定显示宽高）
                            c = canvas.Canvas(temp_pdf_path, pagesize=(page_width, page_height))
                            stamp_x = x - (draw_width / 2)
                            stamp_y = y - (draw_height / 2)
                            c.drawImage(temp_img_path, stamp_x, stamp_y,
                                       width=draw_width, height=draw_height, mask='auto')
                            c.save()
                            
                            # 合并印章到当前页
                            stamp_reader = PdfReader(temp_pdf_path)
                            stamp_page = stamp_reader.pages[0]
                            page.merge_page(stamp_page)
                            
                            # 清理临时文件
                            try:
                                os.remove(temp_img_path)
                                os.remove(temp_pdf_path)
                            except:
                                pass
                
                pdf_writer.add_page(page)
            
            with open(self.output_path, "wb") as f:
                pdf_writer.write(f)
            
            progress.stop()
            progress.destroy()
            messagebox.showinfo("成功", f"盖章完成，文件已保存到:\n{self.output_path}")
        except Exception as e:
            progress.stop()
            progress.destroy()
            messagebox.showerror("错误", f"发生错误: {str(e)}")

if __name__ == "__main__":
    root = tk.Tk()
    app = StampApp(root)
    root.mainloop()