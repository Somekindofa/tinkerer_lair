// Custom View Transitions animation: the outgoing page slides left and
// blurs out, the incoming page slides in from the right and blurs in (and
// the reverse when navigating back). Keyframes live in global.css.
export const slideBlur = {
  forwards: {
    old: [{ name: 'slide-blur-out-left', duration: '0.32s', easing: 'ease-in', fillMode: 'both' }],
    new: [{ name: 'slide-blur-in-right', duration: '0.38s', easing: 'ease-out', fillMode: 'both' }],
  },
  backwards: {
    old: [{ name: 'slide-blur-out-right', duration: '0.32s', easing: 'ease-in', fillMode: 'both' }],
    new: [{ name: 'slide-blur-in-left', duration: '0.38s', easing: 'ease-out', fillMode: 'both' }],
  },
};
