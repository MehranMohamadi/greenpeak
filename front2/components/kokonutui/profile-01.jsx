"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Bell, CreditCard, FileText, LogOut, Settings, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SAMPLE_PROFILE_DATA = {
    name: "Admin User",
    email: "admin@greenpeak.com",
    avatar: "/user-icon.jpg",
    subscription: "Premium",
    role: "System Administrator",
};

export default function ProfileDropdown({
    data = SAMPLE_PROFILE_DATA,
    className,
    showLabel = false,
    ...props
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    // Use authenticated user data if available, otherwise fallback to sample data
    const profileData = user ? {
        ...data,
        name: user.username,
        role: user.role === 'admin' ? 'System Administrator' : 'User',
        email: user.role === 'admin' ? 'admin@greenpeak.com' : 'user@greenpeak.com'
    } : data;

    const menuItems = [
        {
            label: "Profile",
            href: "#",
            icon: <User className="w-4 h-4" />,
        },
        {
            label: "Subscription",
            value: profileData.subscription,
            href: "#",
            icon: <CreditCard className="w-4 h-4" />,
        },
        {
            label: "Notifications",
            href: "#",
            icon: <Bell className="w-4 h-4" />,
        },
        {
            label: "Settings",
            href: "/settings",
            icon: <Settings className="w-4 h-4" />,
        },
        {
            label: "Help & Support",
            href: "/help",
            icon: <FileText className="w-4 h-4" />,
        },
    ];

    return (
        <div className={cn("relative", className)} {...props}>
            <DropdownMenu onOpenChange={setIsOpen}>
                <div className="group relative">
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                "flex items-center focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all duration-200",
                                showLabel
                                    ? "w-full rounded-lg p-2 text-sm hover:bg-gray-100 dark:hover:bg-[#1F1F23]"
                                    : "rounded-full"
                            )}
                        >
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 p-0.5 hover:scale-105 transition-transform duration-200">
                                <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-zinc-900">
                                    <Image
                                        src={profileData.avatar}
                                        alt={profileData.name}
                                        width={28}
                                        height={28}
                                        className="w-full h-full object-cover rounded-full"
                                    />
                                </div>
                            </div>
                            {showLabel && (
                                <span className="ml-3 text-gray-600 dark:text-gray-300">
                                    Profile
                                </span>
                            )}
                        </button>
                    </DropdownMenuTrigger>

                    {/* Green themed bending line indicator */}
                    <div
                        className={cn(
                            "absolute -right-2 top-1/2 -translate-y-1/2 transition-all duration-200",
                            isOpen
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-60"
                        )}
                    >
                        <svg
                            width="8"
                            height="16"
                            viewBox="0 0 8 16"
                            fill="none"
                            className={cn(
                                "transition-all duration-200",
                                isOpen
                                    ? "text-green-500 dark:text-green-400"
                                    : "text-zinc-400 dark:text-zinc-500"
                            )}
                            aria-hidden="true"
                        >
                            <path
                                d="M1 3C4 6 4 10 1 13"
                                stroke="currentColor"
                                strokeWidth="1"
                                strokeLinecap="round"
                                fill="none"
                            />
                        </svg>
                    </div>

                    <DropdownMenuContent
                        align="end"
                        sideOffset={4}
                        className="w-64 p-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl shadow-xl shadow-zinc-900/5 dark:shadow-zinc-950/20 
                    data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-top-right"
                    >
                        {/* User Info Header */}
                        <div className="px-3 py-2 border-b border-zinc-200/60 dark:border-zinc-800/60 mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 p-0.5">
                                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-zinc-900">
                                        <Image
                                            src={profileData.avatar}
                                            alt={profileData.name}
                                            width={36}
                                            height={36}
                                            className="w-full h-full object-cover rounded-full"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                        {profileData.name}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {profileData.role}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            {menuItems.map((item) => (
                                <DropdownMenuItem key={item.label} asChild>
                                    <Link
                                        href={item.href}
                                        className="flex items-center p-3 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 rounded-xl transition-all duration-200 cursor-pointer group hover:shadow-sm border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-700/50"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="text-zinc-600 dark:text-zinc-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                                                {item.icon}
                                            </div>
                                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight whitespace-nowrap group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors">
                                                {item.label}
                                            </span>
                                        </div>
                                        <div className="flex-shrink-0 ml-auto">
                                            {item.value && (
                                                <span
                                                    className={cn(
                                                        "text-xs font-medium rounded-md py-1 px-2 tracking-tight",
                                                        "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10 border border-green-500/10"
                                                    )}
                                                >
                                                    {item.value}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </div>

                        <DropdownMenuSeparator className="my-3 bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-800" />

                        <DropdownMenuItem asChild>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 p-3 duration-200 bg-red-500/10 rounded-xl hover:bg-red-500/20 cursor-pointer border border-transparent hover:border-red-500/30 hover:shadow-sm transition-all group"
                            >
                                <LogOut className="w-4 h-4 text-red-500 group-hover:text-red-600" />
                                <span className="text-sm font-medium text-red-500 group-hover:text-red-600">
                                    Sign Out
                                </span>
                            </button>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </div>
            </DropdownMenu>
        </div>
    );
}
