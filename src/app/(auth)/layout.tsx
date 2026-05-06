/**
 * 认证页面布局：在主题色基础上加入柔和的渐变光斑装饰，
 * 让 login/register/forgot-password 等页面更有质感（参考设计稿基调）。
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-[calc(100vh-3.5rem)]">
      {/* 装饰：左上紫色光斑 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl"
      >
        <div
          className="relative left-[calc(50%-30rem)] aspect-[1155/678] w-[36rem] rotate-[30deg] bg-gradient-to-tr from-violet-400/40 via-fuchsia-400/30 to-rose-400/40 opacity-60 sm:left-[calc(50%-25rem)] sm:w-[60rem]"
          style={{
            clipPath:
              "polygon(74% 44%, 100% 61%, 97% 26%, 85% 0%, 80% 2%, 72% 32%, 60% 62%, 52% 68%, 47% 58%, 45% 34%, 27% 76%, 0% 64%, 17% 100%, 27% 76%, 76% 97%, 74% 44%)",
          }}
        />
      </div>
      {/* 装饰：右下粉色光斑 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 transform-gpu overflow-hidden blur-3xl"
      >
        <div
          className="relative left-[calc(50%+10rem)] aspect-[1155/678] w-[30rem] -rotate-[15deg] bg-gradient-to-tr from-rose-400/40 via-pink-400/30 to-fuchsia-400/40 opacity-50 sm:left-[calc(50%+15rem)] sm:w-[50rem]"
          style={{
            clipPath:
              "polygon(74% 44%, 100% 61%, 97% 26%, 85% 0%, 80% 2%, 72% 32%, 60% 62%, 52% 68%, 47% 58%, 45% 34%, 27% 76%, 0% 64%, 17% 100%, 27% 76%, 76% 97%, 74% 44%)",
          }}
        />
      </div>
      {children}
    </div>
  );
}
