import {Button, Stack, TextInput, Text} from "@mantine/core";
import {useForm} from "@mantine/form";
import axios from "axios";
import {API_BASE_URL} from "@/constants/appConfig";
import Cookies from "js-cookie";

axios.defaults.withCredentials = true;     // ← send cookies
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';

export function CreateCompanyForm() {
  const form = useForm({
    initialValues: {
      name: '',
    },

    validate: {
      name: (val) => {
        if (val.length < 3) return 'Company name should include at least 3 characters';
        if (val.length > 50) return 'Company name should include at most 50 characters';
        if (!(/^[a-zA-Z0-9 ]+$/).test(val)) return 'Company name should only include letters and numbers and spaces';
        return null;
      },
    },
  });

  async function handleSubmit() {
    axios.post(`${API_BASE_URL}/company/create`,
      form.values,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': Cookies.get('csrftoken'),
        },
        withCredentials: true,
      }
    ).then((response) => {
      if (response.status === 201) {
        localStorage.setItem('company_id', response.data.id);
        localStorage.setItem('company_name', response.data.name);
        window.location.reload();
      } else {
        alert(response.data.error);
      }
    }).catch((error) => {
      console.log(error);
      alert('Something went wrong');
    });
  }

  return (
    <div>
      <Text size="lg" fw={500}>Create a new company</Text>
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            required
            label="Company Name"
            placeholder="Your company name"
            radius="md"
            value={form.values.name}
            onChange={(event) => form.setFieldValue('name', event.currentTarget.value)}
            // error={form.errors.name && 'Invalid first name'}
          />
          <Button type="submit">Create</Button>
        </Stack>
      </form>
    </div>
  )
}