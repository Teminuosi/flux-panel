/**
 * 兼容 http(非安全上下文)+ 弹窗(焦点陷阱)的复制。
 *
 * 两个坑:
 * 1. navigator.clipboard 只在 https / localhost 下可用;http://IP:端口 访问时它是
 *    undefined,得回退到 execCommand。
 * 2. HeroUI/react-aria 的 Modal 有“焦点陷阱”,会把临时输入框的焦点/选区抢回弹窗,
 *    导致 execCommand 复制到弹窗里残留的半截选区 → “只复制了一半”甚至失败。
 *
 * 解决:回退方案不依赖输入框选区,而是
 *   ① 注册 copy 事件监听,在事件里直接 clipboardData.setData 写入【整段文本】;
 *   ② 用文档级 Range(不受焦点影响)选中一个临时节点,触发 execCommand('copy')。
 * 这样无论弹窗怎么抢焦点,写进剪贴板的永远是完整文本。
 *
 * @returns 是否复制成功
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // 1) 安全上下文(https/localhost)优先用标准 API
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 安全上下文下仍可能因权限失败,落到下面的回退方案
  }

  // 2) http / 弹窗回退
  try {
    let wrote = false;
    const onCopy = (e: ClipboardEvent) => {
      // 直接写整段文本,不管当前选区是什么 → 绝不会“只复制一半”
      e.clipboardData?.setData("text/plain", text);
      e.preventDefault();
      wrote = true;
    };
    document.addEventListener("copy", onCopy, true);

    // 用文档级 Range 选中临时节点,保证 execCommand('copy') 会触发 copy 事件。
    // Range 选区是文档级的,不像 <input>.select() 那样依赖元素焦点,弹窗抢焦点也在。
    const span = document.createElement("span");
    span.textContent = text;
    span.style.position = "fixed";
    span.style.top = "0";
    span.style.left = "0";
    span.style.opacity = "0";
    span.style.whiteSpace = "pre";
    (span.style as any).userSelect = "text";
    document.body.appendChild(span);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(span);
    selection?.removeAllRanges();
    selection?.addRange(range);

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }

    selection?.removeAllRanges();
    document.body.removeChild(span);
    document.removeEventListener("copy", onCopy, true);
    return ok || wrote;
  } catch {
    return false;
  }
}
