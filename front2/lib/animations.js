// Animation utilities for enhanced UI/UX

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

export const fadeInDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

export const fadeInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.5 }
}

export const fadeInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.5 }
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.4 }
}

export const slideInUp = {
  initial: { opacity: 0, y: 50 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

// Enhanced hover animations
export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { type: "spring", stiffness: 400, damping: 17 }
}

export const hoverGlow = {
  whileHover: { 
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
    y: -2
  },
  transition: { duration: 0.2 }
}

// Loading animations
export const pulseAnimation = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.7, 1, 0.7],
  },
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut"
  }
}

export const spinAnimation = {
  animate: { rotate: 360 },
  transition: { duration: 1, repeat: Infinity, ease: "linear" }
}

// Page transition animations
export const pageTransition = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.3 }
}

// Chart animations
export const chartEnter = {
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { duration: 1.5, ease: "easeOut" }
}

// Card stack animation
export const cardStack = (index) => ({
  initial: { opacity: 0, y: 50, scale: 0.95 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      delay: index * 0.1,
      duration: 0.5,
      ease: "easeOut"
    }
  }
})

// Button press animation
export const buttonPress = {
  whileTap: { scale: 0.95 },
  transition: { duration: 0.1 }
}

// Notification slide in
export const notificationSlide = {
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 100, opacity: 0 },
  transition: { type: "spring", stiffness: 500, damping: 30 }
}

// Enhanced CSS classes for animations
export const animationClasses = {
  // Fade animations
  'animate-fade-in': 'animate-[fadeIn_0.5s_ease-out]',
  'animate-fade-in-up': 'animate-[fadeInUp_0.6s_ease-out]',
  'animate-fade-in-down': 'animate-[fadeInDown_0.6s_ease-out]',
  'animate-fade-in-left': 'animate-[fadeInLeft_0.6s_ease-out]',
  'animate-fade-in-right': 'animate-[fadeInRight_0.6s_ease-out]',
  
  // Scale animations
  'animate-scale-in': 'animate-[scaleIn_0.4s_ease-out]',
  'animate-scale-up': 'animate-[scaleUp_0.3s_ease-out]',
  
  // Slide animations
  'animate-slide-up': 'animate-[slideUp_0.5s_ease-out]',
  'animate-slide-down': 'animate-[slideDown_0.5s_ease-out]',
  'animate-slide-left': 'animate-[slideLeft_0.5s_ease-out]',
  'animate-slide-right': 'animate-[slideRight_0.5s_ease-out]',
  
  // Bounce animations
  'animate-bounce-in': 'animate-[bounceIn_0.6s_cubic-bezier(0.68,-0.55,0.265,1.55)]',
  
  // Pulse animations
  'animate-pulse-slow': 'animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]',
  'animate-pulse-fast': 'animate-[pulse_1s_cubic-bezier(0.4,0,0.6,1)_infinite]',
  
  // Rotate animations
  'animate-rotate-slow': 'animate-[spin_3s_linear_infinite]',
  
  // Hover effects
  'hover-lift': 'transition-all duration-200 hover:transform hover:-translate-y-1 hover:shadow-lg',
  'hover-scale': 'transition-transform duration-200 hover:scale-105',
  'hover-glow': 'transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/25',
  
  // Loading states
  'loading-skeleton': 'animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]',
  
  // Stagger delays
  'delay-75': 'animation-delay-75',
  'delay-100': 'animation-delay-100', 
  'delay-150': 'animation-delay-150',
  'delay-200': 'animation-delay-200',
  'delay-300': 'animation-delay-300'
}

// Custom keyframes for Tailwind config
export const customKeyframes = {
  fadeIn: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' }
  },
  fadeInUp: {
    '0%': { opacity: '0', transform: 'translateY(20px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' }
  },
  fadeInDown: {
    '0%': { opacity: '0', transform: 'translateY(-20px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' }
  },
  fadeInLeft: {
    '0%': { opacity: '0', transform: 'translateX(-20px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' }
  },
  fadeInRight: {
    '0%': { opacity: '0', transform: 'translateX(20px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' }
  },
  scaleIn: {
    '0%': { opacity: '0', transform: 'scale(0.9)' },
    '100%': { opacity: '1', transform: 'scale(1)' }
  },
  scaleUp: {
    '0%': { transform: 'scale(1)' },
    '100%': { transform: 'scale(1.05)' }
  },
  slideUp: {
    '0%': { opacity: '0', transform: 'translateY(50px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' }
  },
  slideDown: {
    '0%': { opacity: '0', transform: 'translateY(-50px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' }
  },
  slideLeft: {
    '0%': { opacity: '0', transform: 'translateX(50px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' }
  },
  slideRight: {
    '0%': { opacity: '0', transform: 'translateX(-50px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' }
  },
  bounceIn: {
    '0%': { opacity: '0', transform: 'scale(0.3)' },
    '50%': { opacity: '1', transform: 'scale(1.05)' },
    '70%': { transform: 'scale(0.9)' },
    '100%': { opacity: '1', transform: 'scale(1)' }
  },
  shimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' }
  }
}
