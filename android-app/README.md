# 工地排班考勤 Android App

将排工考勤系统打包为 Android APK，安装后像原生 App 一样使用。

## 系统要求

- Windows / macOS / Linux
- [Android Studio](https://developer.android.com/studio) (最新版即可)

## 构建步骤

### 1. 用 Android Studio 打开项目

启动 Android Studio → Open → 选择 `android-app` 文件夹，等待 Gradle 同步完成。

### 2. 构建 APK

菜单栏：**Build → Build Bundle(s) / APK(s) → Build APK(s)**

等待构建完成，点击弹出提示中的 **locate** 查看生成的 APK 文件。

### 3. 安装到手机

方法一：用数据线连接手机，启用 USB 调试，直接 Run 到手机  
方法二：把生成的 `app-debug.apk` 传到手机上点击安装

### 输出位置

```
android-app/app/build/outputs/apk/debug/app-debug.apk
```

## 项目结构

```
android-app/
├── app/
│   ├── build.gradle              # 模块配置
│   └── src/main/
│       ├── AndroidManifest.xml   # 权限、Activity声明
│       ├── java/.../MainActivity.java  # WebView主界面
│       └── res/                   # 图标、布局、颜色
├── build.gradle                   # 项目配置
├── settings.gradle                # 模块声明
└── gradle/wrapper/               # Gradle Wrapper
```

## 技术说明

- 使用 WebView 加载 `https://slhfwq.pythonanywhere.com/paiban`
- 仅需网络权限，无其他敏感权限
- 支持 Cookie 持久化、文件上传
- 最小 Android 版本：8.0 (API 26)
- 如需发布到应用商店，需对 APK 签名
