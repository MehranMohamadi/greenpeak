"use client"

import { createContext, useContext, useState, useEffect } from "react"

const AuthContext = createContext({})

// Demo credentials - accepts any username/password
const VALID_CREDENTIALS = {
  username: "greenpeak",
  password: "123456",
  role: "admin",
  name: "Demo User"
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = () => {
      console.log('🔍 Checking authentication status on mount')
      
      // Check if localStorage is available
      if (typeof window === 'undefined' || !window.localStorage) {
        console.log('❌ localStorage not available')
        setIsLoading(false)
        return
      }
      
      try {
        const storedAuth = localStorage.getItem('sp500_auth')
        const storedUser = localStorage.getItem('sp500_user')
        
        console.log('💾 localStorage values:', { 
          storedAuth, 
          storedUser: storedUser ? 'present' : 'null' 
        })
        
        if (storedAuth === 'true' && storedUser) {
          const userData = JSON.parse(storedUser)
          console.log('✅ Found valid auth data, setting authenticated')
          setIsAuthenticated(true)
          setUser(userData)
        } else {
          console.log('❌ No valid auth data found')
        }
      } catch (error) {
        console.error('🚨 Auth check error:', error)
        // Clear invalid data
        localStorage.removeItem('sp500_auth')
        localStorage.removeItem('sp500_user')
      }
      console.log('🏁 Auth check complete, setting loading to false')
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (username, password) => {
    console.log('🔐 Login attempt:', { username, password: '***' })
    
    // Check if localStorage is available
    if (typeof window === 'undefined' || !window.localStorage) {
      console.log('❌ localStorage not available during login')
      return { 
        success: false, 
        error: 'Storage not available. Please ensure cookies/localStorage are enabled.' 
      }
    }
    
    try {
      // Demo mode - accept any credentials
      if (username && password) {
        console.log('✅ Credentials valid (demo mode)')
        const userData = {
          username: username,
          name: username === VALID_CREDENTIALS.username ? VALID_CREDENTIALS.name : username,
          role: "demo",
          loginTime: new Date().toISOString()
        }

        // Store authentication state
        console.log('💾 Storing auth data in localStorage')
        localStorage.setItem('sp500_auth', 'true')
        localStorage.setItem('sp500_user', JSON.stringify(userData))
        
        // Verify storage worked
        const verifyAuth = localStorage.getItem('sp500_auth')
        const verifyUser = localStorage.getItem('sp500_user')
        console.log('🔍 Verification:', { verifyAuth, verifyUser: verifyUser ? 'stored' : 'failed' })
        
        console.log('🔄 Setting auth state')
        setIsAuthenticated(true)
        setUser(userData)
        
        console.log('✅ Login successful:', userData)
        return { success: true, user: userData }
      } else {
        console.log('❌ Invalid credentials')
        return { 
          success: false, 
          error: 'Invalid credentials. Please check your username and password.' 
        }
      }
    } catch (error) {
      console.error('🚨 Login error:', error)
      return { 
        success: false, 
        error: 'An unexpected error occurred. Please try again.' 
      }
    }
  }

  const logout = () => {
    try {
      // Clear storage
      localStorage.removeItem('sp500_auth')
      localStorage.removeItem('sp500_user')
      
      // Reset state
      setIsAuthenticated(false)
      setUser(null)
      
      // Force page reload to ensure clean state
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
      // Force reload even if there's an error
      window.location.href = '/login'
    }
  }

  const value = {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
