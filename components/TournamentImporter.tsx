'use client';
import {useMemo,useState} from 'react';
import Papa from 'papaparse';
import {appFetch} from '@/lib/client-api';
import {canonicalRows,csvTemplate,FIELDS,importErrors,type ImportKind,type ImportRow} from '@/lib/imports';

type Props={tournamentId:string;kind:ImportKind;teams:string[];onSuccess:()=>void};
export function TournamentImporter({tournamentId,kind,teams,onSuccess}:Props){
 const [raw,setRaw]=useState<string[][]>([]);const [columnMap,setColumnMap]=useState<Record<string,number>>({});const [fileName,setFileName]=useState('');
 const [message,setMessage]=useState('');const [replace,setReplace]=useState(false);const [busy,setBusy]=useState(false);
 const headers=raw[0]??[];
 const records=useMemo<ImportRow[]>(()=>raw.slice(1).filter(row=>row.some(v=>v.trim())).map(row=>Object.fromEntries(FIELDS[kind].map(f=>[f.key,row[columnMap[f.key]??-1]??'']))),[raw,columnMap,kind]);
 const normalized=useMemo(()=>canonicalRows(kind,records),[kind,records]);
 const issues=useMemo(()=>importErrors(kind,normalized,teams),[kind,normalized,teams]);
 async function load(file:File){setMessage('');setRaw([]);setFileName(file.name);
  try{
   if(file.size>3_000_000)throw new Error('Maximum file size is 3 MB. Split larger imports into batches.');
   let rows:string[][];
   if(file.name.toLowerCase().endsWith('.xlsx')){
    const {readSheet}=await import('read-excel-file/browser');
    const xlsx=await readSheet(file);
    rows=xlsx.map(row=>row.map(v=>v instanceof Date?v.toISOString().slice(0,10):v==null?'':String(v)));
   }else if(file.name.toLowerCase().endsWith('.csv')){
    const text=await file.text();const parsed=Papa.parse<string[]>(text,{skipEmptyLines:'greedy'});
    if(parsed.errors.length)throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
    rows=parsed.data;
   }else throw new Error('Upload CSV or XLSX files only.');
   if(rows.length>2001)throw new Error('Maximum 2,000 data rows per import.');
   const first=rows[0]??[];
   const map:Record<string,number>={};
   for(const field of FIELDS[kind]){
    const aliases=[field.key,field.label,field.key.replace(/_/g,' ')].map(s=>s.toLowerCase().replace(/[^a-z0-9]/g,''));
    map[field.key]=first.findIndex(h=>aliases.includes(h.toLowerCase().replace(/[^a-z0-9]/g,'')));
   }
   setColumnMap(map);setRaw(rows);
  }catch(error){setMessage((error as Error).message);}
 }
 function download(){
   const blob=new Blob([csvTemplate(kind)],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`s3v-${kind}-template.csv`;a.click();URL.revokeObjectURL(url);
 }
 async function confirm(){if(issues.length||!records.length)return;setBusy(true);try{
   const result=await appFetch(`/api/admin/tournaments/${tournamentId}/imports`,{method:'POST',body:JSON.stringify({kind,rows:normalized,replace:kind==='fixtures'&&replace})}) as {imported:number};
   setMessage(`Imported ${result.imported} ${kind} records. 0 rejected, 0 duplicates.`);setRaw([]);onSuccess();
  }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 return <div className="import-workspace">
  <div className="toolbar"><label className="outline-btn file-picker">UPLOAD {kind.toUpperCase()} CSV/XLSX<input type="file" accept=".csv,.xlsx" onChange={e=>{const file=e.target.files?.[0];if(file)void load(file);e.currentTarget.value='';}}/></label><button type="button" className="outline-btn" onClick={download}>DOWNLOAD TEMPLATE ↓</button></div>
  <p className="helper">Imports are previewed and validated before saving. You can rearrange columns using the mapping controls below. Draft tournaments only.</p>
  {fileName&&<p className="response-note">File: {fileName} · {records.length} data rows</p>}
  {headers.length>0&&<>
   <div className="mapping-grid">{FIELDS[kind].map(field=><label key={field.key}>{field.label}{field.required?' *':''}<select value={columnMap[field.key]??-1} onChange={e=>setColumnMap(prev=>({...prev,[field.key]:Number(e.target.value)}))}><option value={-1}>Not mapped</option>{headers.map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}</select></label>)}</div>
   <p className="kicker">PREVIEW — FIRST FIVE RECORDS</p><div className="import-preview"><table><thead><tr>{FIELDS[kind].map(f=><th key={f.key}>{f.label}</th>)}</tr></thead><tbody>{normalized.slice(0,5).map((row,i)=><tr key={i}>{FIELDS[kind].map(f=><td key={f.key}>{row[f.key]}</td>)}</tr>)}</tbody></table></div>
   <p>{issues.length?`${issues.length} issues found. Correct them before importing.`:`${records.length} rows passed preview validation.`}</p>
   {issues.length>0&&<ul className="import-errors">{issues.slice(0,20).map((issue,i)=><li key={i}>{issue}</li>)}</ul>}
   {kind==='fixtures'&&<label className="checkline"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/> Update existing fixture IDs in this draft tournament (never silently replace records)</label>}
   <button type="button" disabled={busy||issues.length>0||!records.length} className="primary" onClick={confirm}>{busy?'IMPORTING…':`CONFIRM ${records.length} ${kind.toUpperCase()} ↗`}</button>
  </>}
  {message&&<p role="status" className="response-note">{message}</p>}
 </div>;
}
