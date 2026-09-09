import {render,screen,within} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {IncidentWorkbench} from './IncidentWorkbench';
import {labs} from '@/lib/labs';
vi.mock('./InvestigationFlow',()=>({InvestigationFlow:({lab}:{lab:{id:string;hosted:boolean}})=><section aria-label="Learning flow">{lab.hosted?'Fixed hosted operation':'Local VM investigation'}</section>}));
beforeEach(()=>localStorage.clear());
it('routes all cases and keeps the investigation first',()=>{render(<IncidentWorkbench initialLab="03"/>);const nav=screen.getByRole('navigation',{name:'Choose a lab'});for(const lab of labs)expect(within(nav).getByRole('link',{name:new RegExp(lab.shortTitle,'i')})).toHaveAttribute('href',`/labs/${lab.id}`);expect(within(nav).getByRole('link',{name:/connect failures/i})).toHaveAttribute('aria-current','page');expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Why Can’t This Service Connect?');expect(screen.getByLabelText('Learning flow')).toHaveTextContent('Local VM investigation');expect(screen.queryByText('Layer separation')).not.toBeInTheDocument();});
it('uses the same learning workspace for hosted cases',()=>{render(<IncidentWorkbench initialLab="02"/>);expect(screen.getByLabelText('Learning flow')).toHaveTextContent('Fixed hosted operation');expect(screen.getByRole('link',{name:/understand the evidence boundary/i})).toHaveAttribute('href','/guide#boundaries');});
