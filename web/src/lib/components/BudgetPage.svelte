<script>
  import { grantsStore } from '../stores/grants.svelte.js';
  import { router, navigate, updateQuery, getCurrentYear } from '../router.svelte.js';
  import { onMount } from 'svelte';
  import { Chart, registerables } from 'chart.js';

  // Register Chart.js components
  Chart.register(...registerables);

  // Initialize from URL or default to current year
  const currentYear = getCurrentYear();
  let yearFilter = $state(router.query.year || String(currentYear));
  let lastYearUpdate = yearFilter;

  // Update URL when year filter changes (with loop prevention)
  $effect(() => {
    if (yearFilter !== lastYearUpdate) {
      lastYearUpdate = yearFilter;
      updateQuery({ year: yearFilter === '' ? null : yearFilter });
    }
  });

  // Chart instances
  let pieChart = null;
  let barChart = null;
  let pieCanvas;
  let barCanvas;

  // Category metadata
  const categories = [
    { key: 'A', label: 'Category A', color: 'rgb(59, 130, 246)', bgColor: 'rgba(59, 130, 246, 0.8)' },
    { key: 'B', label: 'Category B', color: 'rgb(34, 197, 94)', bgColor: 'rgba(34, 197, 94, 0.8)' },
    { key: 'C', label: 'Category C', color: 'rgb(249, 115, 22)', bgColor: 'rgba(249, 115, 22, 0.8)' },
    { key: 'D', label: 'Category D', color: 'rgb(168, 85, 247)', bgColor: 'rgba(168, 85, 247, 0.8)' },
  ];

  // Get unique years from grants (as strings for select binding)
  let availableYears = $derived.by(() => {
    const years = new Set();
    grantsStore.grants.forEach(g => {
      if (g.Year) years.add(String(g.Year));
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  });

  // Filter grants by year AND budget inclusion (based on status)
  let filteredGrants = $derived.by(() => {
    const budgetStatuses = grantsStore.budgetStatuses;
    let result = grantsStore.grants.filter(g => budgetStatuses.includes(g.Status));

    if (yearFilter) {
      result = result.filter(g => String(g.Year) === yearFilter);
    }

    return result;
  });

  // Count of grants excluded from budget (for info display)
  let excludedCount = $derived.by(() => {
    const budgetStatuses = grantsStore.budgetStatuses;
    let allGrants = grantsStore.grants;
    if (yearFilter) {
      allGrants = allGrants.filter(g => String(g.Year) === yearFilter);
    }
    return allGrants.filter(g => !budgetStatuses.includes(g.Status)).length;
  });

  // Calculate budget by category for filtered grants
  let categoryBudgets = $derived.by(() => {
    const budgets = { A: 0, B: 0, C: 0, D: 0 };

    filteredGrants.forEach(grant => {
      const amount = parseFloat(grant.Amount) || 0;
      const pctA = parseFloat(grant.Cat_A_Percent) || 0;
      const pctB = parseFloat(grant.Cat_B_Percent) || 0;
      const pctC = parseFloat(grant.Cat_C_Percent) || 0;
      const pctD = parseFloat(grant.Cat_D_Percent) || 0;

      budgets.A += amount * (pctA / 100);
      budgets.B += amount * (pctB / 100);
      budgets.C += amount * (pctC / 100);
      budgets.D += amount * (pctD / 100);
    });

    return budgets;
  });

  // Calculate total budget
  let totalBudget = $derived(categoryBudgets.A + categoryBudgets.B + categoryBudgets.C + categoryBudgets.D);

  // Calculate budget by year (for bar chart)
  let budgetByYear = $derived.by(() => {
    const yearData = {};

    availableYears.forEach(year => {
      yearData[year] = { A: 0, B: 0, C: 0, D: 0 };

      grantsStore.grants
        .filter(g => g.Year === parseInt(year))
        .forEach(grant => {
          const amount = parseFloat(grant.Amount) || 0;
          const pctA = parseFloat(grant.Cat_A_Percent) || 0;
          const pctB = parseFloat(grant.Cat_B_Percent) || 0;
          const pctC = parseFloat(grant.Cat_C_Percent) || 0;
          const pctD = parseFloat(grant.Cat_D_Percent) || 0;

          yearData[year].A += amount * (pctA / 100);
          yearData[year].B += amount * (pctB / 100);
          yearData[year].C += amount * (pctC / 100);
          yearData[year].D += amount * (pctD / 100);
        });
    });

    return yearData;
  });

  // Grant breakdown with calculated category amounts
  let grantBreakdown = $derived.by(() => {
    return filteredGrants.map(grant => {
      const amount = parseFloat(grant.Amount) || 0;
      const pctA = parseFloat(grant.Cat_A_Percent) || 0;
      const pctB = parseFloat(grant.Cat_B_Percent) || 0;
      const pctC = parseFloat(grant.Cat_C_Percent) || 0;
      const pctD = parseFloat(grant.Cat_D_Percent) || 0;

      return {
        ID: grant.ID,
        Organization: grant.Organization,
        Year: grant.Year,
        amount,
        categoryA: amount * (pctA / 100),
        categoryB: amount * (pctB / 100),
        categoryC: amount * (pctC / 100),
        categoryD: amount * (pctD / 100),
      };
    }).sort((a, b) => b.amount - a.amount);
  });

  // Format currency
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Update charts when data changes
  $effect(() => {
    const budgets = categoryBudgets;
    const yearData = budgetByYear;

    if (pieCanvas && budgets) {
      updatePieChart(budgets);
    }

    if (barCanvas && yearData) {
      updateBarChart(yearData);
    }
  });

  function updatePieChart(budgets) {
    const data = [budgets.A, budgets.B, budgets.C, budgets.D];

    if (pieChart) {
      pieChart.data.datasets[0].data = data;
      pieChart.update();
    } else {
      pieChart = new Chart(pieCanvas, {
        type: 'pie',
        data: {
          labels: categories.map(c => c.label),
          datasets: [{
            data,
            backgroundColor: categories.map(c => c.bgColor),
            borderColor: categories.map(c => c.color),
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = context.raw;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                },
              },
            },
          },
        },
      });
    }
  }

  function updateBarChart(yearData) {
    const years = Object.keys(yearData).sort();

    if (barChart) {
      barChart.data.labels = years;
      barChart.data.datasets.forEach((dataset, i) => {
        const cat = categories[i].key;
        dataset.data = years.map(y => yearData[y][cat]);
      });
      barChart.update();
    } else {
      barChart = new Chart(barCanvas, {
        type: 'bar',
        data: {
          labels: years,
          datasets: categories.map(cat => ({
            label: cat.label,
            data: years.map(y => yearData[y][cat.key]),
            backgroundColor: cat.bgColor,
            borderColor: cat.color,
            borderWidth: 1,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
            },
            y: {
              stacked: true,
              ticks: {
                callback: (value) => formatCurrency(value),
              },
            },
          },
          plugins: {
            legend: {
              position: 'bottom',
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                },
              },
            },
          },
        },
      });
    }
  }

  // Cleanup charts on unmount
  onMount(() => {
    return () => {
      if (pieChart) {
        pieChart.destroy();
        pieChart = null;
      }
      if (barChart) {
        barChart.destroy();
        barChart = null;
      }
    };
  });

  // Navigate to grant
  function goToGrant(id) {
    navigate(`/grant/${encodeURIComponent(id)}`);
  }
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex justify-between items-start">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Budget Overview</h1>
      <p class="text-gray-500 mt-1">
        {filteredGrants.length} funded grants · {formatCurrency(totalBudget)} total
        {#if excludedCount > 0}
          <span class="text-gray-400">· {excludedCount} pre-funding excluded</span>
        {/if}
      </p>
    </div>
    <div class="w-40">
      <label for="year-filter" class="block text-xs font-medium text-gray-500 mb-1">Filter by Year</label>
      <select
        id="year-filter"
        bind:value={yearFilter}
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <option value="">All years</option>
        {#each availableYears as year}
          <option value={year}>{year}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Category Summary Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    {#each categories as cat}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-500">{cat.label}</span>
          <div class="w-3 h-3 rounded-full" style="background-color: {cat.color}"></div>
        </div>
        <p class="text-2xl font-bold text-gray-900 mt-2">
          {formatCurrency(categoryBudgets[cat.key])}
        </p>
        {#if totalBudget > 0}
          <p class="text-xs text-gray-500 mt-1">
            {((categoryBudgets[cat.key] / totalBudget) * 100).toFixed(1)}% of total
          </p>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Charts Row -->
  <div class="grid md:grid-cols-2 gap-6">
    <!-- Pie Chart -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">
        Allocation by Category
        {#if yearFilter}
          ({yearFilter})
        {/if}
      </h3>
      <div class="h-64">
        <canvas bind:this={pieCanvas}></canvas>
      </div>
    </div>

    <!-- Bar Chart -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Category Breakdown by Year</h3>
      <div class="h-64">
        <canvas bind:this={barCanvas}></canvas>
      </div>
    </div>
  </div>

  <!-- Budget Table -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <h3 class="text-lg font-medium text-gray-900">Grant-by-Grant Breakdown</h3>
    </div>

    {#if filteredGrants.length === 0}
      <div class="p-12 text-center">
        <p class="text-gray-500">No grants to display.</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Grant
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Organization
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Amount
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider">
                Category A
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-green-600 uppercase tracking-wider">
                Category B
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-orange-600 uppercase tracking-wider">
                Category C
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-purple-600 uppercase tracking-wider">
                Category D
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each grantBreakdown as row (row.ID)}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <button
                    onclick={() => goToGrant(row.ID)}
                    class="text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                  >
                    {row.ID}
                  </button>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row.Organization || '—'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                  {formatCurrency(row.amount)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right {row.categoryA > 0 ? 'text-blue-700' : 'text-gray-400'}">
                  {row.categoryA > 0 ? formatCurrency(row.categoryA) : '—'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right {row.categoryB > 0 ? 'text-green-700' : 'text-gray-400'}">
                  {row.categoryB > 0 ? formatCurrency(row.categoryB) : '—'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right {row.categoryC > 0 ? 'text-orange-700' : 'text-gray-400'}">
                  {row.categoryC > 0 ? formatCurrency(row.categoryC) : '—'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right {row.categoryD > 0 ? 'text-purple-700' : 'text-gray-400'}">
                  {row.categoryD > 0 ? formatCurrency(row.categoryD) : '—'}
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot class="bg-gray-50">
            <tr class="font-semibold">
              <td class="px-6 py-4 text-sm text-gray-900" colspan="2">
                Total ({grantBreakdown.length} grants)
              </td>
              <td class="px-6 py-4 text-sm text-gray-900 text-right">
                {formatCurrency(totalBudget)}
              </td>
              <td class="px-6 py-4 text-sm text-blue-700 text-right">
                {formatCurrency(categoryBudgets.A)}
              </td>
              <td class="px-6 py-4 text-sm text-green-700 text-right">
                {formatCurrency(categoryBudgets.B)}
              </td>
              <td class="px-6 py-4 text-sm text-orange-700 text-right">
                {formatCurrency(categoryBudgets.C)}
              </td>
              <td class="px-6 py-4 text-sm text-purple-700 text-right">
                {formatCurrency(categoryBudgets.D)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    {/if}
  </div>
</div>
