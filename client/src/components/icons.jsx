// Custom hand-drawn line-icon set — coral/ink strokes on cream, matching the
// brand's documented illustration language. Replaces generic emoji throughout.
const base = {
  fill: "none",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Svg({ size = 20, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" {...base}>
      {children}
    </svg>
  );
}

export function IconOverview(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </Svg>
  );
}

export function IconGift(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="9" width="17" height="11" rx="1.6" />
      <path d="M3.5 13.2H20.5" />
      <path d="M12 9V20.2" />
      <path d="M12 9C12 9 8.6 9 8 6.8C7.6 5.4 8.6 4 10 4.4C11.4 4.8 12 9 12 9Z" />
      <path d="M12 9C12 9 15.4 9 16 6.8C16.4 5.4 15.4 4 14 4.4C12.6 4.8 12 9 12 9Z" />
    </Svg>
  );
}

export function IconConfetti(props) {
  return (
    <Svg {...props}>
      <path d="M5 13L6.4 14.4" />
      <path d="M9 5L9.9 6.9" />
      <path d="M17.5 9.5L19 8.5" />
      <circle cx="15" cy="5.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="19.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <path d="M10.5 10.5L18 18" />
      <path d="M6.5 18.5C6.5 18.5 9 19 10.5 17.5C12 16 9.5 14 8.5 15.5C7.5 17 8.5 19.5 6.5 18.5Z" />
    </Svg>
  );
}

export function IconUsers(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8.2" r="3" />
      <path d="M3.5 19C3.5 15.4 6 13.4 9 13.4C12 13.4 14.5 15.4 14.5 19" />
      <path d="M15.5 6.4C16.9 6.8 17.9 8 17.9 9.5C17.9 11 16.9 12.2 15.5 12.6" />
      <path d="M16.5 13.6C18.7 14.2 20.2 15.9 20.2 19" />
    </Svg>
  );
}

export function IconLayers(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.5L20.5 8L12 12.5L3.5 8L12 3.5Z" />
      <path d="M3.5 12.5L12 17L20.5 12.5" />
      <path d="M3.5 16.8L12 21.2L20.5 16.8" />
    </Svg>
  );
}

export function IconCoins(props) {
  return (
    <Svg {...props}>
      <ellipse cx="9" cy="7" rx="5.5" ry="3" />
      <path d="M3.5 7V13C3.5 14.7 6 16 9 16C12 16 14.5 14.7 14.5 13V7" />
      <path d="M3.5 10C3.5 11.7 6 13 9 13C12 13 14.5 11.7 14.5 10" />
      <path d="M12.5 15.4C13 17.6 15.5 19.2 18 19.2C20.5 19.2 21 17.6 21 16.6C21 14.8 18.5 15 18.5 13.3C18.5 12.3 19.5 11.8 20.7 12.3" />
    </Svg>
  );
}

export function IconClock(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12L15.2 14" />
    </Svg>
  );
}

export function IconCalendarStar(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5H20.5" />
      <path d="M8 3V6.5" />
      <path d="M16 3V6.5" />
      <path d="M12 12.5L12.9 14.3L14.9 14.6L13.4 16L13.8 18L12 17L10.2 18L10.6 16L9.1 14.6L11.1 14.3L12 12.5Z" />
    </Svg>
  );
}

export function IconPhone(props) {
  return (
    <Svg {...props}>
      <path d="M6 3.5H9L10.3 7.3L8.3 8.8C9.1 10.7 10.6 12.2 12.5 13L14 11L17.8 12.3V15.3C17.8 16.5 16.7 17.4 15.6 17.1C10 15.6 5.6 11.2 4.1 5.6C3.8 4.5 4.7 3.5 6 3.5Z" />
    </Svg>
  );
}

export function IconMessage(props) {
  return (
    <Svg {...props}>
      <path d="M4 5.5H20V16H9.5L5.5 19V16H4V5.5Z" />
    </Svg>
  );
}

export function IconNote(props) {
  return (
    <Svg {...props}>
      <path d="M6 3.5H15L18.5 7V20.5H6V3.5Z" />
      <path d="M15 3.5V7H18.5" />
      <path d="M8.5 12H15.5" />
      <path d="M8.5 15.5H15.5" />
    </Svg>
  );
}

export function IconRefresh(props) {
  return (
    <Svg {...props}>
      <path d="M4.5 12C4.5 8 7.8 4.7 11.8 4.7C14.5 4.7 16.9 6.2 18.1 8.4" />
      <path d="M19.5 12C19.5 16 16.2 19.3 12.2 19.3C9.5 19.3 7.1 17.8 5.9 15.6" />
      <path d="M18.1 4.7V8.4H14.4" />
      <path d="M5.9 19.3V15.6H9.6" />
    </Svg>
  );
}
