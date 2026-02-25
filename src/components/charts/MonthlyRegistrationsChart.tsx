"use client";

import { CadastrosMensaisCard } from "@/components/charts/CadastrosMensaisCard";

export type MonthlyRegistrationsChartEntry = {
  month: number;
  label: string;
  value: number;
};

export function MonthlyRegistrationsChart({
  data,
  year,
  years,
  onYearChange,
  onMonthSelect,
  selectedMonth = null,
  previousYearData
}: {
  data: MonthlyRegistrationsChartEntry[];
  year: number;
  years: number[];
  onYearChange: (value: number) => void;
  onMonthSelect?: (month: number | null) => void;
  selectedMonth?: number | null;
  previousYearData?: MonthlyRegistrationsChartEntry[];
}) {
  return (
    <CadastrosMensaisCard
      data={data}
      year={year}
      years={years}
      onYearChange={onYearChange}
      onMonthSelect={onMonthSelect}
      selectedMonth={selectedMonth}
      previousYearData={previousYearData}
    />
  );
}
