"use client";

import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
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
                const token = Cookies.get("auth_token");

                if (!token) {
                    router.replace(`/auth?redirect=${encodeURIComponent(window.location.pathname || "/")}`);
                    return;
                }

                const response = await fetch(API_BASE_URL + "/auth/check", {
                    method: "GET",
                    credentials: "include",
                });

                if (response.ok) {
                    setIsAuthenticated(true);
                } else {
                    router.replace(`/auth?redirect=${encodeURIComponent(window.location.pathname || "/")}`);
                }
                setLoading(false);
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