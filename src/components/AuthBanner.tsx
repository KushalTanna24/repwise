import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { go } from '@/lib/route';
import { useSyncState } from '@/sync/useSync';
import { useLaunch } from './Splash';

const SHOW_MS = 6000;

/** Top banner for sign-in results, after the splash. Success fades on its own; a link error stays until dismissed. */
export function AuthBanner() {
  const notice = useSyncState((s) => s.notice);
  const clearNotice = useSyncState((s) => s.clearNotice);
  const splashDone = useLaunch((s) => s.splashDone);
  const reduce = useReducedMotion();
  const y = reduce ? 0 : -120;

  useEffect(() => {
    if (!splashDone || notice?.kind !== 'signed-in') return;
    const t = setTimeout(clearNotice, SHOW_MS);
    return () => clearTimeout(t);
  }, [splashDone, notice, clearNotice]);

  return (
    <AnimatePresence>
      {splashDone && notice && (
        <motion.div
          key={notice.kind}
          role="status"
          data-banner
          initial={{ y, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y, opacity: 0 }}
          transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 32 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.6, bottom: 0.1 }}
          onDragEnd={(_, i) => i.offset.y < -30 && clearNotice()}
          onClick={notice.kind === 'signed-in' ? clearNotice : undefined}
          className="fixed inset-x-2 top-[calc(env(safe-area-inset-top)+8px)] z-[91] mx-auto flex max-w-[620px] cursor-grab items-start gap-3 rounded-[22px] bg-[rgb(250_250_250/0.85)] p-3 shadow-[0_8px_30px_rgb(0_0_0/0.18)] backdrop-blur-2xl backdrop-saturate-150"
        >
          <img src="/icon.svg" alt="" className="size-[38px] shrink-0 rounded-[9px]" />
          <div className="min-w-0 flex-1">
            {notice.kind === 'signed-in' ? (
              <p className="text-subhead leading-snug text-label">You're signed in as {notice.email}. Backing up now.</p>
            ) : (
              <>
                <p className="text-subhead leading-snug text-label">{notice.message}</p>
                <div className="mt-1 flex gap-4 text-subhead font-semibold text-blue">
                  <button
                    type="button"
                    onClick={() => {
                      go('profile');
                      clearNotice();
                    }}
                  >
                    Send a new link
                  </button>
                  <button type="button" onClick={clearNotice} className="text-label-2">
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
