
import registerObjectEvents from './objects/events';
import registerSolverEvents from './compute/events';
import './network/network-events';


export default function registerAllEvents(){
  registerObjectEvents();
  registerSolverEvents();
}
