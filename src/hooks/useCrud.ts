import { useState } from "react";
import {
  fetcherDelete,
  fetcherGet,
  fetcherPost,
  fetcherPut,
} from "../configs/axios";
import { filterSerachParams } from "../utils/filterSerachParams";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

type Endpoints = {
  list: string;
  single: string;
  create: string;
};

const useCrud = (endpoints: Endpoints) => {
  const [searchParams] = useSearchParams();
  const params = Object.fromEntries(searchParams.entries());
  const [data, setData] = useState<any>(null);
  const [single, setSingle] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  const fetchData = async ({
    page,
    pageSize,
    order,
    sortKey,
    filters,
    filter,
  }: any) => {
    const queryParams = filterSerachParams({
      page,
      pageSize,
      order,
      sortKey,
      filters: { ...filters, ...filter },
    });

    setLoading(true);
    try {
      const response = await fetcherGet(`${endpoints.list}/?${queryParams}`);
      setData(response);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const createData = async (newData: any) => {
    setLoading(true);
    try {
      const response = await fetcherPost(endpoints.create, newData);
      setData(response);
      return response;
    } catch (err: any) {
      err.errors
        ? err.errors.map((error: any) => {
            toast.error(error.message);
          })
        : toast.error(err.message);
      setError(err);
      throw err;
    } finally {
      await fetchData(params);
      setLoading(false);
    }
  };

  const updateData = async (id: string, updatedData: any) => {
    setLoading(true);
    try {
      const response = await fetcherPut(
        `${endpoints.single}/${id}`,
        updatedData
      );
      setData(response);
      return response;
    } catch (err: any) {
      err.errors
        ? err.errors.map((error: any) => {
            toast.error(error.message);
          })
        : toast.error(err.message);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteData = async (id: string) => {
    setLoading(true);
    try {
      await fetcherDelete(`${endpoints.single}/${id}`);
      setData((prevData: any) =>
        prevData.filter((item: any) => item.id !== id)
      );
      await fetchData(params);
    } catch (err: any) {
      toast.error(err.message);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const getSingle = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetcherGet(`${endpoints.single}/${id}`);
      setSingle(response);
      return response;
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    single,
    loading,
    error,
    fetchData,
    createData,
    updateData,
    deleteData,
    getSingle,
  };
};

export default useCrud;
