// Constantes de datos: columnas, etiquetas, íconos y paginación.

export const DB_COLS = [
  'apellido','nombres','dni','telefonos','mail',
  'domicilio','ciudad','contacto_familia','medico_tratante',
  'patologia','patologia1','patologia2','diagnostico_medico',
  'historia_clinica','epicrisis','estudios_complementarios',
  'observaciones','enfermeria','kinesiologia',
  'otros_profesionales','otros'
];

export const CTRL_COLS = [
  'fecha','enfermeria','kinesiologia','diagnostico_medico',
  'observaciones','otros_profesionales','otros'
];

export const DB_LABELS = {
  apellido:'Apellido',nombres:'Nombres',dni:'DNI',telefonos:'Teléfonos',
  mail:'Mail',domicilio:'Domicilio',ciudad:'Ciudad',
  contacto_familia:'Contacto Familia',medico_tratante:'Médico Tratante',
  patologia:'Patología',patologia1:'Patología 1',patologia2:'Patología 2',
  diagnostico_medico:'Diagnóstico Médico',historia_clinica:'Historia Clínica',
  epicrisis:'Epicrisis',estudios_complementarios:'Estudios',
  observaciones:'Observaciones',enfermeria:'Enfermería',
  kinesiologia:'Kinesiología',otros_profesionales:'Otros Profesionales',otros:'Otros'
};

export const CTRL_LABELS = {
  fecha:'Fecha',enfermeria:'Enfermería',kinesiologia:'Kinesiología',
  diagnostico_medico:'Diagnóstico',observaciones:'Observaciones',
  otros_profesionales:'Otros Profesionales',otros:'Otros'
};

export const TAGS=['tag-blue','tag-green','tag-amber','tag-cyan'];

export const ICO_EYE=`<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;

export const ICO_EDIT=`<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>`;

export const ICO_DEL=`<polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/>`;

export const ICO_USERS=`<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>`;

export const ICO_DOC=`<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>`;

export const ICO_FLASK=`<path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2h-4"/>`;

export const VIEW_TITLES={dashboard:'Dashboard',pacientes:'Pacientes',historia:'Historias Clínicas',estudios:'Estudios Complementarios',profesionales:'Profesionales Médicos',usuarios:'Gestión de Usuarios'};

export const PER        = 10;
