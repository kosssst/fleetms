"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, ComponentType } from "react";
import { checkAuth } from "@/services/auth.service";
import { Loading } from "@/components/common/Loading";

const withAuth = <P extends object>(WrappedComponent: ComponentType<P>) => {
    const ProtectedRoute = (props: P) => {
        const router = useRouter();
        const [loading, setLoading] = useState(true);
        const [isAuthenticated, setIsAuthenticated] = useState(false);

        useEffect(() => {
            const verifyAuth = async () => {
                try {
                    await checkAuth();
                    setIsAuthenticated(true);
                } catch {
                    router.replace(`/auth?redirect=${encodeURIComponent(window.location.pathname || "/")}`);
                } finally {
                    setLoading(false);
                }
            };

            verifyAuth();
        }, [router]);

        if (loading) {
            return <Loading />;
        }
        if (!isAuthenticated) {
            return null;
        }

        return <WrappedComponent {...props} />;
    };

    return ProtectedRoute;
};

export default withAuth;
