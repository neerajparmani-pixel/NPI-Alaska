export function prepareVisits(state) {
  const site = state.sites[0].id,
    company = state.companies[0].id,
    task = state.tasks[0].id;
  const contract = "60000000-0000-0000-0000-000000000001",
    scope = "70000000-0000-0000-0000-000000000001",
    snow = "80000000-0000-0000-0000-000000000001",
    sand = "80000000-0000-0000-0000-000000000002";
  state.contracts = [{ id: contract, name: "Court maintenance", active: true }];
  state.scopes = [
    {
      id: scope,
      contract_id: contract,
      company_id: company,
      site_id: site,
      active: true,
    },
  ];
  state.tasks[0].active = true;
  state.work = [];
  state.members = [];
  state.reviews = [];
  state.visits = {
    items: [
      {
        id: snow,
        contract_id: contract,
        task_id: task,
        code: "A",
        name: "Clear snow",
        unit: "visit",
        snow_required: true,
        active: true,
        version: 1,
      },
      {
        id: sand,
        contract_id: contract,
        task_id: task,
        code: "C",
        name: "Sand",
        unit: "yard",
        active: true,
        version: 1,
      },
      {
        id: "80000000-0000-0000-0000-000000000011",
        contract_id: contract,
        parent_id: snow,
        task_id: task,
        code: "A1",
        name: "2 to under 4 inches",
        unit: "visit",
        min_inches: 2,
        max_inches: 4,
        active: true,
      },
      {
        id: "80000000-0000-0000-0000-000000000012",
        contract_id: contract,
        parent_id: snow,
        task_id: task,
        code: "A2",
        name: "4 to under 8 inches",
        unit: "visit",
        min_inches: 4,
        max_inches: 8,
        active: true,
      },
    ],
    scopes: [
      {
        ...state.scopes[0],
        site_name: state.sites[0].name,
        contract_name: "Court maintenance",
        address: "Training address — verify before live use",
        latitude: 61.2181,
        longitude: -149.8923,
      },
    ],
    crew: state.people.filter((p) => p.role === "worker"),
    lines: [],
    duplicates: [],
  };
  return { snow, sand, scope };
}
