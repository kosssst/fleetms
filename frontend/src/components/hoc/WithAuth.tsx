"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/constants/appConfig";

import { ComponentType } from "react";

const withAuth = (WrappedComponent: ComponentType) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function ProtectedRoute(props: any) {
        const router = useRouter();
        const [loading, setLoading] = useState(true);
        const [isAuthenticated, setIsAuthenticated] = useState(false);

        useEffect(() => {
            async function checkAuth() {
                try {
                    const response = await fetch(API_BASE_URL + "/auth/check", {
                        method: "GET",
                        credentials: "include",
                    });

                    if (response.ok) {
                        setIsAuthenticated(true);
                    } else {
                        router.replace(`/auth?redirect=${encodeURIComponent(window.location.pathname || "/")}`);
                    }
                } catch (error) {
                    console.error("Auth check failed:", error);
                    router.replace(`/auth?redirect=${encodeURIComponent(window.location.pathname || "/")}`);
                } finally {
                    setLoading(false);
                }
            }

            checkAuth();
        }, [router]);

        if (loading) {
            return <div>Loading...</div>;
        }
        if (!isAuthenticated) {
            return null;
        }

        return <WrappedComponent {...props} />;
    };
};

export default withAuth;