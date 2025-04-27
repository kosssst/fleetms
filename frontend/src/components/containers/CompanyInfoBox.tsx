import classes from './CompanyInfoBox.module.scss';
import {
  Button,
  Paper,
  Text,
} from '@mantine/core';
import {useEffect, useState} from "react";
import axios from "axios";
import {API_BASE_URL} from "@/constants/appConfig";
import {CreateCompanyForm} from "@/components/forms/CreateCompanyForm";

export function CompanyInfoBox() {
  const companyId = localStorage.getItem('company_id');
  const [ type, setType ] = useState('companyInfo');

  useEffect(() => {
    if (companyId) {
      setType('companyInfo');
    } else {
      axios.get(`${API_BASE_URL}/company/`, {
        withCredentials: true
      }).then(response => {
        if (response.status === 200) {
          localStorage.setItem('company_id', response.data.id);
          localStorage.setItem('company_name', response.data.name);
        } else {
          setType('createCompany');
        }
      }).catch((error) => {
        setType('createCompany');
        console.log(error);
      })
    }
  }, [companyId]);

  if (type === 'createCompany') {
    return (
      <Paper radius="md" p="sm" withBorder className={classes.companyInfoBox}>
        <Text size="sm" fw={500}>
          You are not in the company yet
          <br/>
          Either create a new company or wait for an invitation
        </Text>
        <Button onClick={() => { setType('createCompanyForm'); }}>Create</Button>
      </Paper>
    );
  } else if (type === 'companyInfo') {
    const companyName = localStorage.getItem('company_name');
    return (
      <Paper radius="md" p="sm" withBorder className={classes.companyInfoBox}>
        <Text size="lg" fw={500}>{companyName}</Text>
        <Text size="xs" fw={500}>id: {companyId}</Text>
      </Paper>
    );
  } else if (type === 'createCompanyForm') {
    return (
      <Paper radius="md" p="sm" withBorder className={classes.companyInfoBox}>
        <CreateCompanyForm />
      </Paper>
    )
  } else {
    return (
      <Paper radius="md" p="sm" withBorder className={classes.companyInfoBox}>
        <Text size="lg" fw={500}>Error fetching company information</Text>
      </Paper>
    );
  }
}
