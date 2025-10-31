import { Table } from "antd";
import React, { ReactNode, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "./Table.scss";
import TableHeader from "./tableHeader.tsx/TableHeader";

interface TableBlockProps {
  title: string;
  columns: any[];
  data: any[];
  isLoading: boolean;
  count: number;
  expandedComponent?: ReactNode;
  onCreate?: () => void;
  searchBar?: boolean;
}

const TableBlock = ({
  title,
  columns,
  data,
  count,
  isLoading,
  expandedComponent,
  searchBar,
  onCreate,
}: TableBlockProps) => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    setSearchParams({ ...Object.fromEntries(searchParams) });
  }, []);

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    // Add pagination search filter sord data
    const obj = {
      page: pagination.current.toString(),
      pageSize: pagination.pageSize.toString(),
      sortKey: sorter.field,
      order: sorter.order === "ascend" ? "asc" : "desc",
      ...filters,
    };

    for (const key in obj) {
      setSearchParams((prev: URLSearchParams) => {
        if (obj[key] && (!Array.isArray(obj[key]) || obj[key].length > 0)) {
          prev.set(key, obj[key]);
        } else {
          prev.delete(key);
        }
        return prev;
      });
    }
  };

  return (
    <>
      <TableHeader onCreate={onCreate} title={title} searchBar={searchBar} />
      <div className={`table-wrapper single_row_title`}>
        <div className="custom-scrollbar">
          <Table
            rowKey={(record: any) => record?.id?.toString()}
            columns={columns}
            dataSource={data || []}
            loading={isLoading}
            showSorterTooltip={{}}
            onChange={handleTableChange}
            rowClassName={(record: any) => {
              return record?.is_opened == false &&
                record?.is_opened != undefined
                ? "highlight-row"
                : "";
            }}
            pagination={{
              current: searchParams.get("page")
                ? Number(searchParams.get("page"))
                : 1,
              pageSize: Number(searchParams.get("pageSize")) || 10,
              total: count || 0,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
            }}
            scroll={{ y: `calc(100vh - ${365})`, x: "max-content" }}
            expandable={
              expandedComponent
                ? {
                    expandedRowRender: (record: any) =>
                      React.cloneElement(
                        expandedComponent as React.ReactElement,
                        { data: record }
                      ),
                  }
                : undefined
            }
            style={{ minHeight: 200, height: "100%" }}
          />
        </div>
      </div>
    </>
  );
};

export default TableBlock;
