"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useGeoGebra } from "@/hooks/use-geogebra"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface GeoGebraPanelProps {
  onHide: () => void
  onExecuteLatestCommands: () => void
}

export function GeoGebraPanel({ onHide, onExecuteLatestCommands }: GeoGebraPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const { reset, setSize, isReady, loadNewFile, saveNewFile, executeCommand } = useGeoGebra()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)
  const [commands, setCommands] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // 计算尺寸的函数
  const calculateDimensions = useCallback(() => {
    if (!panelRef.current || !titleRef.current) return

    const height = panelRef.current.clientHeight - titleRef.current.clientHeight
    const width = panelRef.current.clientWidth

    // 只有当尺寸真正变化时才更新状态和调整大小
    if (width !== dimensions.width || height !== dimensions.height) {
      setDimensions({ width, height })
      if (isReady && width > 0 && height > 0) {
        setSize(width, height)
        const container = document.getElementById("geogebra-container")
        if (container) {
          container.style.width = width + 'px'
          container.style.height = height + 'px'
        }
      }
    }
  }, [dimensions.width, dimensions.height, isReady, setSize])

  // 执行多行命令
  const executeMultiLineCommands = () => {
    if (!commands.trim()) return
    
    // 分割命令，过滤空行
    const commandLines = commands.split('\n')
      .map(cmd => cmd.includes("// ")? cmd = cmd.trim().substring(0,cmd.trim().indexOf("//")):cmd.trim())
      .filter(cmd => cmd.length > 0)
    
    // 逐行执行命令
    commandLines.forEach((cmd, index) => {
      // 添加微小延迟，确保命令按顺序执行
      setTimeout(() => {
        executeCommand(cmd)
      }, index * 100)
    })
    
    // 关闭对话框并清空命令
    setIsDialogOpen(false)
    setCommands("")
  }

  // 调整GeoGebra大小 - 只在组件挂载和isReady变化时执行
  useEffect(() => {
    if (!isReady) return

    // 初始化时计算一次尺寸
    if (!isInitializedRef.current) {
      calculateDimensions()
      isInitializedRef.current = true
    }

    // 添加防抖的resize事件监听器
    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }

      resizeTimeoutRef.current = setTimeout(() => {
        calculateDimensions()
      }, 100)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [isReady, calculateDimensions])

  return (
    <div id="geogebra-panel" ref={panelRef} className="flex flex-col h-full lg:w-[50%] hidden lg:block border-l">
      <div id="geogebra-title" ref={titleRef} className="flex items-center justify-between p-4 border-b">
        <h3 className="text-xl font-medium">GeoGebra</h3>
        <div className="flex gap-2">
          <Button
            variant="outline" 
            size="sm" 
            className="h-8"
            onClick={() => {
              // Create a file input element
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.ggb'; // Only accept GGB files
              
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (event) => {
                  const base64 = event.target?.result as string;
                  // Remove the data URL prefix if present
                  const base64Data = base64.split(',')[1] || base64;
                  loadNewFile({ ggbBase64: base64Data });
                };
                reader.readAsDataURL(file);
              };
              
              // Trigger the file selection dialog
              input.click();
            }}
          >
            加载 ggb
          </Button>

          <Button
            variant="outline" size="sm" 
            className="h-8"
            onClick={() => saveNewFile()}
          >
            导出 ggb
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                输入命令
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>输入GeoGebra命令</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Textarea
                  value={commands}
                  onChange={(e) => setCommands(e.target.value)}
                  placeholder="输入多行GeoGebra命令，每行一个命令"
                  rows={10}
                />
                <Button onClick={executeMultiLineCommands}>
                  执行命令
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" onClick={onExecuteLatestCommands} className="h-8">
            执行命令
          </Button>
          <Button variant="outline" size="sm" onClick={reset} className="h-8">
            清理
          </Button>
          <Button variant="outline" size="sm" onClick={onHide} className="h-8">
            隐藏
          </Button>
        </div>
      </div>
      <div id="geogebra-container" className="w-full flex-grow"></div>
    </div>
  )
}
