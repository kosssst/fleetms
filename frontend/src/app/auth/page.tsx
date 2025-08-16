import { AuthenticationForm } from "@/components/forms/AuthenticationForm";
import '@/styles/auth.css';
import { Suspense } from "react";

export default function Auth() {
    return (
        <div className='centercontent'>
            <Suspense>
                <AuthenticationForm />
            </Suspense>
        </div>
    )
}