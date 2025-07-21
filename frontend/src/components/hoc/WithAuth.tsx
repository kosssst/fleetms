"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, ComponentType } from "react";
import { checkAuth } from "@/services/auth.service";

const withAuth = <P extends object>(WrappedComponent: ComponentType<P>) => {
    const ProtectedRoute = (props: P) => {
        const router = useRouter();
        const [loading, setLoading] = useState(true);
        const [isAuthenticated, setIsAuthenticated] = useState(false);

        useEffect(() => {
            console.log("withAuth: useEffect triggered.");
            const verifyAuth = async () => {
                try {
                    console.log("withAuth: Calling checkAuth()...");
                    await checkAuth();
                    console.log("withAuth: checkAuth() successful. User is authenticated.");
                    setIsAuthenticated(true);
                } catch (error) {
                    console.error("withAuth: checkAuth() failed.", error);
                    console.log("withAuth: Redirecting to login page.");
                    router.replace(`/auth?redirect=${encodeURIComponent(window.location.pathname || "/")}`);
                } finally {
                    console.log("withAuth: Setting loading to false.");
                    setLoading(false);
                }
            };

            verifyAuth();
        }, [router]);

        console.log("withAuth: Rendering component.", { loading, isAuthenticated });

        if (loading) {
            console.log("withAuth: Render -> Loading...");
            return <div>Loading...</div>;
        }
        if (!isAuthenticated) {
            console.log("withAuth: Render -> Not authenticated, returning null.");
            return null;
        }

        console.log("withAuth: Render -> Authenticated, rendering wrapped component.");
        return <WrappedComponent {...props} />;
    };

    return ProtectedRoute;
};

export default withAuth;