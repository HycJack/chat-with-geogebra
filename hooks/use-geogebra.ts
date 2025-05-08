"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { logger } from "@/lib/logger"

export interface GeoGebraCommands {
  reset: () => void
  executeCommand: (cmd: string) => boolean
  executeCommands: (commands: string[]) => void
  setSize: (width: number, height: number) => void
  isReady: boolean
  loadNewFile: (options: { filename?: string; ggbBase64?: string }) => void
  saveNewFile: (filename?: string) => void
}

interface GeoGebraOptions {
  filename?: string
  ggbBase64?: string
}

export function useGeoGebra(options?: GeoGebraOptions): GeoGebraCommands {
  const [isReady, setIsReady] = useState(false)
  const scriptRef = useRef<HTMLScriptElement | null>(null)
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null)
  const appletInitializedRef = useRef(false)
  const lastSizeRef = useRef({ width: 0, height: 0 })
  const optionsRef = useRef<GeoGebraOptions>(options || {})

  const initializeApplet = useCallback((options: GeoGebraOptions) => {
    if (typeof window.GGBApplet === "undefined") {
      logger.error("GGBApplet 类不可用")
      return
    }

    logger.ggb("准备初始化GeoGebra applet")
    
    const ggbAppParams: any = {
      appName: "classic",
      width: "100%",
      height: "100%",
      showToolBar: true,
      showAlgebraInput: true,
      showMenuBar: true,
      enableLabelDrags: false,
      enableShiftDragZoom: true,
      enableRightClick: true,
      showResetIcon: true,
      useBrowserForJS: false,
      allowStyleBar: false,
      scaleContainerClass: "geogebra-container",
      preventFocus: false,
      language: "zh",
      appletOnLoad: () => {
        logger.ggb("GeoGebra applet 加载完成并初始化")
        window.ggbAppletReady = true
        appletInitializedRef.current = true
        setIsReady(true)
      },
    }

    // 添加文件名或base64数据
    if (options.filename) {
      ggbAppParams.filename = options.filename
    }
    if (options.ggbBase64) {
      ggbAppParams.ggbBase64 = options.ggbBase64
    }

    // 如果已经有applet实例，先移除旧的
    if (window.ggbApplet) {
      try {
        const container = document.getElementById("geogebra-container")
        if (container) {
          container.innerHTML = '' // 清空容器
        }
      } catch (e) {
        logger.error("移除旧applet时出错:", e)
      }
    }

    // 重新注入新的applet
    if (document.getElementById("geogebra-container")) {
      logger.ggb("找到geogebra-container，注入GeoGebra applet")
      const ggbApp = new window.GGBApplet(ggbAppParams, true)
      ggbApp.inject("geogebra-container")
      logger.ggb("GeoGebra applet 注入完成")
    } else {
      logger.warn("未找到geogebra-container元素")
    }
  }, [])

  // 加载新文件的方法
  const loadNewFile = useCallback((options: { filename?: string; ggbBase64?: string }) => {
    if (!isReady) {
      logger.warn("GeoGebra尚未准备好，无法加载新文件")
      return
    }

    optionsRef.current = { ...optionsRef.current, ...options }
    initializeApplet(optionsRef.current)
  }, [isReady, initializeApplet])

  // save新文件的方法
  const saveNewFile = useCallback((filename = 'geogebra-file.ggb') => {
    if (!isReady) {
      logger.warn("GeoGebra尚未准备好，无法保存文件")
      return
    }
    if (typeof window.GGBApplet === "undefined") {
      logger.error("GGBApplet 类不可用")
      return
    }

    try {
      logger.ggb("准备保存 GeoGebra 文件")
      
      // 获取当前状态的base64数据
      const base64 = window.ggbApplet.getBase64()
      
      // 创建下载链接
      const link = document.createElement('a')
      link.href = `data:application/octet-stream;base64,${base64}`
      link.download = filename.endsWith('.ggb') ? filename : `${filename}.ggb`
      
      // 触发下载
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      logger.ggb(`文件已保存: ${filename}`)
    } catch (e) {
      logger.error("保存文件失败:", e)
      return 
    }
    return 
  }, [isReady])

  // 初始化GeoGebra
  useEffect(() => {
    // 防止重复加载脚本
    if (scriptRef.current || appletInitializedRef.current) return

    const script = document.createElement("script")
    scriptRef.current = script
    script.src = "https://www.geogebra.org/apps/deployggb.js"
    script.async = true
    document.body.appendChild(script)

    script.onload = () => {
      logger.ggb("GeoGebra script 加载完成")
      initializeApplet(optionsRef.current)
    }

    const checkLoaded = () => {
      if (window.ggbApplet && typeof window.ggbApplet.setSize === "function") {
        logger.ggb("✅ GeoGebra 加载完毕！")
        appletInitializedRef.current = true
        setIsReady(true)
      } else if (!appletInitializedRef.current) {
        checkTimerRef.current = setTimeout(checkLoaded, 100) // 每 100 毫秒检测一次
      }
    }

    // 启动检查
    checkTimerRef.current = setTimeout(checkLoaded, 500)

    return () => {
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current)
      }
    }
  }, [initializeApplet])

  // 重置GeoGebra
  const reset = useCallback(() => {
    if (window.ggbApplet) {
      try {
        window.ggbApplet.reset()
        logger.ggb("GeoGebra重置成功")
        return true
      } catch (e) {
        logger.error("GeoGebra重置失败:", e)
        return false
      }
    }
    return false
  }, [])

  // 执行单个GeoGebra命令
  const executeCommand = useCallback((cmd: string): boolean => {
    if (window.ggbApplet) {
      try {
        if(cmd.includes("// ")){
          cmd = cmd.substring(0,cmd.indexOf("//"))
        }
        window.ggbApplet.evalCommand(cmd)
        logger.ggb(`命令执行成功: "${cmd}"`)
        return true
      } catch (e) {
        logger.error(`执行GeoGebra命令失败: "${cmd}"`, e)
        return false
      }
    }
    logger.warn(`GeoGebra applet不可用，无法执行命令: "${cmd}"`)
    return false
  }, [])

  // 执行多个GeoGebra命令
  const executeCommands = useCallback(
    (commands: string[]) => {
      if (!window.ggbApplet || commands.length === 0) {
        logger.warn("GeoGebra applet不可用或没有命令，无法执行命令")
        return
      }

      logger.ggb(`准备执行${commands.length}个GeoGebra命令`)

      // 重置GeoGebra
      reset()

      // 执行所有命令
      commands.forEach((cmd, index) => {
        setTimeout(() => {
          if(cmd.includes("// ")){
            cmd = cmd.substring(0,cmd.indexOf("//"))
          }
          executeCommand(cmd)
        }, index * 100) // 每条命令间隔100ms执行，避免执行过快
      })
    },
    [reset, executeCommand],
  )

  // 设置GeoGebra大小
  const setSize = useCallback((width: number, height: number) => {
    // 避免重复设置相同的尺寸
    if (lastSizeRef.current.width === width && lastSizeRef.current.height === height) {
      return false
    }

    if (window.ggbApplet && typeof window.ggbApplet.setSize === "function" && width > 0 && height > 0) {
      logger.ggb(`设置GeoGebra大小: ${width}x${height}`)
      window.ggbApplet.setSize(width, height)
      lastSizeRef.current = { width, height }
      return true
    }
    return false
  }, [])

  return {
    reset,
    executeCommand,
    executeCommands,
    setSize,
    isReady,
    loadNewFile,
    saveNewFile,
  }
}
