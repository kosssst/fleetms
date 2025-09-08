"use client";

import { CreateCompanyForm } from "@/components/forms/CreateCompanyForm";
import { Paper } from "@mantine/core";
import { Company } from "@/types/company.types";
import { useCompany } from "@/hooks/useCompany";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/types/user.types";

const CreateCompanyPage = () => {
  const { setCompany } = useCompany();
  const { setUser } = useAuth();
  const router = useRouter();

  const handleCompanyCreated = (data: { company: Company, user: User }) => {
    setCompany(data.company);
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    router.push('/company');
  };

  return (
    <div className="main-context">
      <Paper radius="md" p="sm" withBorder>
        <CreateCompanyForm onCompanyCreated={handleCompanyCreated} />
      </Paper>
    </div>
  );
};

export default CreateCompanyPage;