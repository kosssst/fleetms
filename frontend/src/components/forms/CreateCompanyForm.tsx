"use client";

import { Button, Stack, TextInput, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { createCompany } from "@/services/company.service";
import { Company } from "@/types/company.types";

interface CreateCompanyFormProps {
  onCompanyCreated: (company: Company) => void;
}

export function CreateCompanyForm({ onCompanyCreated }: CreateCompanyFormProps) {
  const form = useForm({
    initialValues: {
      name: '',
    },
    validate: {
      name: (val) => {
        if (val.length < 3) return 'Company name should include at least 3 characters';
        if (val.length > 50) return 'Company name should include at most 50 characters';
        if (!/^[a-zA-Z0-9 ]+$/.test(val)) return 'Company name should only include letters, numbers, and spaces';
        return null;
      },
    },
  });

  async function handleSubmit() {
    try {
      const newCompany = await createCompany(form.values.name);
      localStorage.setItem('company_id', newCompany._id);
      onCompanyCreated(newCompany);
    } catch (error) {
      console.error(error);
      alert('Something went wrong');
    }
  }

  return (
    <div>
      <Text size="lg" fw={500}>Create a new company</Text>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            required
            label="Company Name"
            placeholder="Your company name"
            radius="md"
            {...form.getInputProps('name')}
          />
          <Button type="submit">Create</Button>
        </Stack>
      </form>
    </div>
  );
}