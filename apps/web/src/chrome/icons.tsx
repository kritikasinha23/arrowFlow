import { useId } from "react";

type IconProps = { size?: number; className?: string; filled?: boolean };

export function IconBack({ size = 18, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M15.2 5.2 8.4 12l6.8 6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUndo({ size = 18, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M8.2 7.2H5v3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.1 14.8a7 7 0 1 0-.2-4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSpark({ size = 16, className }: IconProps) {
  return (
    <svg className={`icon-spark ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.4 13.85 8.7 20.2 10.2 13.85 11.7 12 18 10.15 11.7 3.8 10.2 10.15 8.7Z"
        fill="currentColor"
      />
      <path d="M18.6 4.2 19.2 6.1 21.1 6.7 19.2 7.3 18.6 9.2 18 7.3 16.1 6.7 18 6.1Z" fill="currentColor" opacity="0.7" />
      <path d="M6.2 15.4 6.6 16.7 7.9 17.1 6.6 17.5 6.2 18.8 5.8 17.5 4.5 17.1 5.8 16.7Z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function IconFlame({ size = 16, className }: IconProps) {
  const uid = useId();
  return (
    <svg className={`icon-flame ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-outer`} x1="8" y1="22" x2="16" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff6a2c" />
          <stop offset="0.45" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#ffc56a" />
        </linearGradient>
        <linearGradient id={`${uid}-core`} x1="12" y1="20" x2="12" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff4c8" />
          <stop offset="1" stopColor="#ffd36a" />
        </linearGradient>
      </defs>
      <path
        d="M12 21.2c4.2 0 6.6-2.9 6.6-6.4 0-2.4-1.1-4.2-2.4-5.9-.4 1.7-1.3 2.8-2.5 3.3C13.6 7.8 12.2 4 12.2 4S8.5 8.5 8.3 12.4C6.7 11.8 5.6 13.2 5.6 15c0 3.4 2.4 6.2 6.4 6.2Z"
        fill={`url(#${uid}-outer)`}
      />
      <path
        className="flame-core"
        d="M12 19.4c2.2 0 3.4-1.5 3.4-3.2 0-1.5-1-2.4-1.9-3.3-.1 1.2-.7 1.8-1.5 2.1.1-1.8-.6-3.6-.6-3.6s-1.8 2.1-1.9 4c-.8-.3-1.4.5-1.4 1.5 0 1.7 1.3 2.5 3.9 2.5Z"
        fill={`url(#${uid}-core)`}
      />
      <path d="M11.2 17.6c.4.7 1.3.8 1.7.2" fill="none" stroke="#fff7d8" strokeWidth="0.7" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function IconShield({ size = 56, className }: IconProps) {
  const uid = useId();
  return (
    <svg className={`icon-shield ${className ?? ""}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-face`} x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b97ff" />
          <stop offset="0.55" stopColor="#5b6cff" />
          <stop offset="1" stopColor="#3d4ad6" />
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="20" y1="8" x2="40" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M32 6.2 53 14.4v16.6c0 13.6-8.6 23.4-21 26.6C19.6 54.4 11 44.6 11 31V14.4Z"
        fill="#3d4ad6"
        opacity="0.22"
        transform="translate(0 1.4)"
      />
      <path d="M32 5.8 52.4 14v16.8c0 13.4-8.5 23-20.4 26.2C20.1 53.8 11.6 44.2 11.6 30.8V14Z" fill={`url(#${uid}-face)`} />
      <path d="M32 9.6 48.4 16v13.6c0 10.6-6.6 18.2-16.4 21V9.6Z" fill="#7b88ff" />
      <path
        d="M32 7.6 50.2 15v15.2c0 12.2-7.7 21-18.2 24-10.5-3-18.2-11.8-18.2-24V15Z"
        fill="none"
        stroke="#2f3bb8"
        strokeWidth="1.3"
      />
      <path d="M32 8.8 26 22.4h12Z" fill="#eef1ff" opacity="0.95" />
      <path d="M32 22.2v17.6M25.2 31h13.6" stroke="#eef1ff" strokeWidth="2.1" strokeLinecap="round" />
      <path className="shield-shine" d="M20 12c8-2 16 1 18 8-7 1-14-1-18-8Z" fill={`url(#${uid}-shine)`} />
    </svg>
  );
}

export function IconTrophy({ size = 56, className }: IconProps) {
  const uid = useId();
  return (
    <svg className={`icon-trophy ${className ?? ""}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-cup`} x1="22" y1="10" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9aa6ff" />
          <stop offset="0.5" stopColor="#7b8cff" />
          <stop offset="1" stopColor="#5b6cff" />
        </linearGradient>
      </defs>
      <path d="M19.4 48.2h25.2l-2.4 6.2H21.8Z" fill="#5b6cff" />
      <path d="M25.6 54.4h12.8v3.6H25.6Z" fill="#3d4ad6" />
      <path d="M22 12.2h20v21.4c0 8.6-4.5 14-10 14s-10-5.4-10-14Z" fill={`url(#${uid}-cup)`} />
      <path d="M24.4 14.4h8.2v18.6c0 6.2-1.6 10.2-4.1 11.6 2.2-4 2.2-9.8 2.2-13.4V14.4Z" fill="#aeb6ff" opacity="0.55" />
      <path d="M22 16.2h-7.4c.2 8.2 3.6 13.4 7.4 15Z" fill="#5b6cff" />
      <path d="M42 16.2h7.4c-.2 8.2-3.6 13.4-7.4 15Z" fill="#5b6cff" />
      <path d="M23.6 9.4h16.8v4.2H23.6Z" fill="#c4cbff" />
      <path d="M26.2 9.4h11.6v1.6H26.2Z" fill="#e8ebff" />
      <circle className="trophy-gleam" cx="36.4" cy="20.2" r="1.7" fill="#fff" />
    </svg>
  );
}

export function IconHome({ size = 22, className, filled = false }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {filled ? (
        <>
          <path
            d="M4.6 11.1 12 4.8l7.4 6.3V19.6a1.2 1.2 0 0 1-1.2 1.2h-4.6v-5.8H9.8v5.8H5.8A1.2 1.2 0 0 1 4.6 19.6Z"
            fill="currentColor"
          />
          <path d="M10.4 14.8h3.2v6H10.4Z" fill="#fff" opacity="0.35" />
          <path d="M16.4 8.2V6.1h2.1v3.6" fill="currentColor" />
        </>
      ) : (
        <path
          d="M4.8 11.2 12 5l7.2 6.2V19.4a1 1 0 0 1-1 1h-4.2v-5.6H9.8V20.4H5.8a1 1 0 0 1-1-1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function IconCalendar({ size = 22, className, filled = false }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {filled ? (
        <>
          <rect x="3.6" y="5.4" width="16.8" height="14.8" rx="2.4" fill="currentColor" />
          <path d="M7.6 3.8v3.2M16.4 3.8v3.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M3.8 9.4h16.4" stroke="#fff" strokeWidth="1.3" />
          <circle cx="8.2" cy="13.2" r="0.9" fill="#fff" />
          <circle cx="12" cy="13.2" r="0.9" fill="#fff" />
          <circle cx="15.8" cy="13.2" r="0.9" fill="#fff" />
          <circle cx="8.2" cy="16.6" r="0.9" fill="#fff" />
          <circle cx="12" cy="16.6" r="0.9" fill="#fff" />
        </>
      ) : (
        <>
          <rect x="4" y="6" width="16" height="14" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 4.2v3.2M16 4.2v3.2M4.4 10h15.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8.4" cy="13.6" r="0.7" fill="currentColor" />
          <circle cx="12" cy="13.6" r="0.7" fill="currentColor" />
          <circle cx="15.6" cy="13.6" r="0.7" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function IconShieldTab({ size = 22, className, filled = false }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {filled ? (
        <>
          <path
            d="M12 3.2 19.2 6v6.2c0 4.8-3.2 8.4-7.2 9.6-4-1.2-7.2-4.8-7.2-9.6V6Z"
            fill="currentColor"
          />
          <path d="M12 7.2v6.4M9.4 10.4h5.2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path
            d="M12 3.6 18.8 6.2v6c0 4.5-3 7.8-6.8 8.9-3.8-1.1-6.8-4.4-6.8-8.9v-6Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M12 7.6v5.8M9.6 10.5h4.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function IconStar({ size = 22, className, filled = false }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {filled ? (
        <>
          <path
            d="m12 3.3 2.5 5.4 5.9.6-4.5 4 1.4 5.8L12 16.2 6.7 19.1l1.4-5.8-4.5-4 5.9-.6Z"
            fill="currentColor"
          />
          <path d="m12 7.2 1.1 2.4 2.6.3-2 1.7.6 2.5L12 12.8" fill="#fff" opacity="0.28" />
        </>
      ) : (
        <path
          d="m12 3.8 2.2 5 5.4.5-4.1 3.6 1.2 5.3L12 15.6 7.3 18.2l1.2-5.3-4.1-3.6 5.4-.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function IconGear({ size = 22, className, filled = false }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {filled ? (
        <>
          <path
            d="M10.1 3.3h3.8l.5 2.1 1.9.8 2-.9 2 2-1 2 .9 1.9.2.6v2.4l-2.1.5-.9 2 1 2-2 2-2-1-1.9.9-.5.2h-2.4l-.5-2.1-1.9-.8-2 .9-2-2 1-2-.9-1.9L3.3 13v-2.4l2.1-.5.9-2-1-2 2-2 2 1 1.9-.9Z"
            fill="currentColor"
          />
          <circle cx="12" cy="12" r="2.5" fill="#fff" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 4.2v2.2M12 17.6v2.2M4.2 12h2.2M17.6 12h2.2M6.3 6.3l1.6 1.6M16.1 16.1l1.6 1.6M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export function IconPin({ size = 14, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 21s6.2-6.1 6.2-11A6.2 6.2 0 0 0 5.8 10C5.8 14.9 12 21 12 21Z" fill="currentColor" />
      <circle cx="12" cy="10" r="2.2" fill="#fff" />
    </svg>
  );
}

export function IconHeart({ size = 17, className, filled = false }: IconProps) {
  const uid = useId();
  return (
    <svg className={`icon-heart ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-heart`} x1="6" y1="20" x2="16" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff3b62" />
          <stop offset="1" stopColor="#ff7a93" />
        </linearGradient>
      </defs>
      <path
        d="M12 20.2s-7.4-4.5-7.4-10.2A4.25 4.25 0 0 1 12 7.1a4.25 4.25 0 0 1 7.4 2.9c0 5.7-7.4 10.2-7.4 10.2Z"
        fill={filled ? `url(#${uid}-heart)` : "currentColor"}
      />
      {filled ? <path d="M8.4 9.2c1.1-1.2 2.6-.8 3.1.2" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" /> : null}
    </svg>
  );
}

export function IconHash({ size = 20, className }: IconProps) {
  return (
    <svg className={`icon-hash ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M9.2 5.4 8 18.6M16.2 5.4 15 18.6M5.2 9.6h14M4.8 14.4h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandMark({ size = 28, className }: IconProps) {
  return (
    <svg className={`brand-mark ${className ?? ""}`} width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="13" fill="#eef1ff" />
      <path
        d="M7.2 9.4 15.8 16 7.2 22.6"
        fill="none"
        stroke="#16161f"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.4 9.4 24 16l-8.6 6.6"
        fill="none"
        stroke="#5b6cff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
