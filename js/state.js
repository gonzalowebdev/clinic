// Estado compartido de la aplicación (único objeto mutable; los módulos importan { state }).
export const state = {
  pacientes: [],
  filteredList: [],
  activeFilter: 'todos',
  searchQuery: '',
  page: 1,
  editId: null,
  deleteId: null,
  entradaPacId: null,
  entradaImgFiles: [], // File objects pending upload
  rptPacId: null,
  rptDays: 7, // 0 = custom
  rptFrom: null,
  rptTo: null,
  rptControles: [], // controles cargados para el período
  csvControles: [],
  profesionales: [],
  editProfId: null,
  selectedProfIds: [], // IDs seleccionados en el multiselect del form paciente
  usuarios: [],
  editUsrId: null,
  currentUser: null,
  isAdmin: false,
  paciente: null,
};
