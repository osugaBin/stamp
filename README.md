# PDF 多页盖章工具 - 在线版

一个基于 Web 的 PDF 多页盖章工具，支持在线为 PDF 文档添加印章，无需安装任何软件。

## 🚀 在线使用

访问部署地址：[https://osugabin.github.io/stamp](https://osugabin.github.io/stamp) 或 [stamp.pzyt.top](https://stamp.pzyt.top)

## 🌟 功能特点

- **📄 PDF 文件支持**: 支持上传和处理多页 PDF 文档
- **🖼️ 印章管理**: 支持上传各种格式的印章图片（PNG、JPG、GIF 等），白底图片即可
- **🎯 精确定位**: 点击或拖拽方式精确放置印章位置
- **📏 尺寸调整**: 灵活调整印章大小（0.01-1.0 倍缩放）
- **📱 响应式设计**: 完美适配桌面端和移动端设备
- **🔄 页面导航**: 便捷的多页面浏览和编辑
- **💾 在线导出**: 直接在浏览器中生成带印章的 PDF 文件
- **🎨 现代化 UI**: 美观的渐变色界面设计
- **⚡ 边界检查**: 自动防止印章超出页面边界

## 📖 使用说明

### 1. 上传文件

- 点击"选择 PDF 文件"按钮上传需要盖章的 PDF 文档
- 点击"选择印章图片"按钮上传印章图片
- 也可以直接拖拽 PDF 文件到预览区域

### 2. 添加印章

- **方法一**: 调整印章大小后，点击"添加印章到当前页"按钮在页面中央添加印章
- **方法二**: 直接点击 PDF 预览区域的任意位置添加印章

### 3. 编辑印章

- **移动**: 拖拽印章到目标位置
- **选择**: 点击印章或印章列表中的项目进行选择
- **删除**: 选中印章后点击"删除选中印章"按钮
- **清空**: 点击"清空当前页"按钮删除当前页所有印章

### 4. 页面导航

- 使用"上一页"/"下一页"按钮浏览多页 PDF
- 页面信息显示当前页码和总页数
- 每页的印章独立管理

### 5. 缩放控制

- 使用"+"/"-"按钮调整 PDF 预览缩放级别
- 支持 50%-300%缩放范围

### 6. 导出 PDF

- 完成所有页面的印章添加后，点击"保存盖章 PDF"按钮
- 系统会自动生成带印章的新 PDF 文件并下载

## 🛠️ 技术栈

- **前端框架**: 原生 JavaScript (ES6+)
- **PDF 处理**: PDF.js - Mozilla 的 PDF 渲染库
- **PDF 生成**: jsPDF - 客户端 PDF 生成库
- **样式**: CSS3 (Flexbox, Grid, 渐变色)
- **响应式**: CSS 媒体查询
- **部署**: GitHub Pages

## 📁 项目结构

```
pdf-stamp-tool/
├── index.html          # 主页面
├── styles.css          # 样式文件
├── app.js             # 主要JavaScript逻辑
├── README.md          # 项目说明
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions部署配置
```

## 🔧 本地开发

1. 克隆项目

```
git clone https://github.com/osugaBin/stamp.git
cd stamp
```

2. 启动本地服务器

```bash
# 使用Python
python -m http.server 8000

# 或使用Node.js
npx serve .

# 或使用PHP
php -S localhost:8000
```

3. 访问 `http://localhost:8000`

## 🚀 部署到 GitHub Pages

### 方法一：自动部署（推荐）

1. Fork 或上传项目到 GitHub 仓库
2. 在仓库设置中启用 GitHub Pages
3. 选择"GitHub Actions"作为部署源
4. 项目包含的 GitHub Actions 工作流会自动部署

### 方法二：手动部署

1. 在 GitHub 仓库设置中启用 GitHub Pages
2. 选择"Deploy from a branch"
3. 选择"main"分支和"/ (root)"文件夹
4. 保存设置，等待部署完成

## 🌐 Cloudflare 部署

1. 登录 Cloudflare Pages
2. 连接 GitHub 仓库
3. 设置构建配置：
   - 构建命令：留空（静态文件）
   - 构建输出目录：`/`
4. 部署完成后获得 Cloudflare 域名

## 🔒 隐私说明

- 所有文件处理均在浏览器本地完成
- 不会上传任何文件到服务器
- 完全保护用户隐私和数据安全

## 🐛 已知问题

- 大型 PDF 文件可能需要较长加载时间
- 某些复杂 PDF 格式可能存在兼容性问题
- 移动端拖拽体验可能不如桌面端流畅

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进项目！

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [PDF.js](https://mozilla.github.io/pdf.js/) - Mozilla PDF 渲染库
- [jsPDF](https://github.com/parallax/jsPDF) - 客户端 PDF 生成库
- [GitHub Pages](https://pages.github.com/) - 免费静态网站托管
- [Cloudflare Pages](https://pages.cloudflare.com/) - 全球 CDN 加速

---

## ☕ 支持开发

如果这个项目对您有帮助，欢迎请我喝杯咖啡！

<div align="center">
  <img src="buycof.png" alt="Buy me a coffee" width="200"/>
  <br/><br/>
  
  <table>
    <tr>
      <td align="center">
        <img src="Ali$.jpg" alt="支付宝收款码" width="150"/>
        <br/>
        <b>Buy me a coffee</b>
      </td>
      <td align="center">
        <img src="Wx$.jpg" alt="微信收款码" width="150"/>
        <br/>
        <b>请我喝咖啡</b>
      </td>
    </tr>
  </table>
</div>

如果这个项目对您有帮助，请给个 ⭐️ 支持一下！
