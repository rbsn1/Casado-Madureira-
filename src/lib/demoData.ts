export const kpi = {
  casadosPeriodo: 48,
  encaminhados: 32,
  integrados: 21,
  batizados: 9,
  servindo: 27
};

export const funnelStages = [
  { label: "Cadastros recebidos", value: 48 },
  { label: "Encaminhados", value: 32 },
  { label: "Contato iniciado", value: 30 },
  { label: "Acompanhamento", value: 24 },
  { label: "Integrados", value: 21 },
  { label: "Batizados", value: 9 }
];

export const volunteerByDepartment = [
  { department: "Louvor", volunteers: 8 },
  { department: "Intercessão", volunteers: 6 },
  { department: "Acolhimento", volunteers: 5 },
  { department: "Kids", volunteers: 4 },
  { department: "Mídia", volunteers: 4 }
];

export const pessoas = [
  {
    id: "1",
    nome: "Ana Souza",
    telefone: "(21) 99999-0000",
    origem: "Culto Domingo",
    status: "ENCAMINHADO",
    responsavel: "Pr. Daniel",
    atualizadoEm: "2026-01-02",
    batismo: "2026-02-10",
    servindo: "Kids"
  },
  {
    id: "2",
    nome: "Carlos Lima",
    telefone: "(21) 98888-7777",
    origem: "Landing Page",
    status: "PENDENTE",
    responsavel: "Equipe Novos Convertidos",
    atualizadoEm: "2026-01-04",
    batismo: "",
    servindo: ""
  },
  {
    id: "3",
    nome: "Fernanda Alves",
    telefone: "(21) 97777-2222",
    origem: "Indicação",
    status: "INTEGRADO",
    responsavel: "Secretaria",
    atualizadoEm: "2025-12-20",
    batismo: "2025-12-05",
    servindo: "Louvor"
  }
];

export const timeline = [
  { tipo: "CADASTRO", descricao: "Cadastro criado via página pública", data: "2026-01-04" },
  { tipo: "ENCAMINHADO", descricao: "Encaminhado para equipe Novos Convertidos", data: "2026-01-04" },
  { tipo: "CONTATO", descricao: "Contato telefônico registrado por Ana Martins", data: "2026-01-05" },
  { tipo: "INTEGRADO", descricao: "Marcado como integrado ao pequeno grupo", data: "2026-01-10" },
  { tipo: "BATISMO", descricao: "Batismo confirmado para 10/02/2026", data: "2026-01-12" }
];

export const filaNovosConvertidos = [
  { nome: "Bruno Nogueira", status: "PENDENTE", responsavel: "A designar", ultima: "2026-01-04" },
  { nome: "Marina Prado", status: "EM_ANDAMENTO", responsavel: "Sara Teixeira", ultima: "2026-01-03" },
  { nome: "Juliana Coelho", status: "CONTATO", responsavel: "Equipe Novos Convertidos", ultima: "2026-01-01" }
];

export const departamentos = [
  { nome: "Louvor", responsavel: "Lucas Almeida", ativo: true, membros: 8 },
  { nome: "Intercessão", responsavel: "Paula Lima", ativo: true, membros: 6 },
  { nome: "Kids", responsavel: "Fernanda Dias", ativo: true, membros: 5 },
  { nome: "Mídia", responsavel: "Rafael Torres", ativo: false, membros: 3 }
];
