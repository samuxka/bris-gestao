import { useEffect, useState } from 'react';
import { 
  addMonths, subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, 
  getDay, isSameDay, isToday, startOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Bell } from 'lucide-react';

export default function Calendario() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [remindEmail, setRemindEmail] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'events'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(docs);
    });
    return unsub;
  }, [user]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const startingDayIndex = getDay(monthStart);
  const prefixDays = Array.from({ length: startingDayIndex }).map((_, i) => i);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !selectedDay || !user) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'events'), {
        userId: user.uid,
        userEmail: user.email,
        title: eventTitle.trim(),
        date: Timestamp.fromDate(selectedDay),
        remindEmail,
        createdAt: serverTimestamp(),
      });

      if (remindEmail) {
        // Gerar link do Google Calendar (dia inteiro)
        const eventDateStr = format(selectedDay, 'yyyyMMdd');
        const endDayStr = format(new Date(selectedDay.getTime() + 86400000), 'yyyyMMdd');
        const gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle.trim())}&dates=${eventDateStr}/${endDayStr}&details=Adicionado%20pelo%20App%20da%20Pastelaria`;

        // Enviar e-mail usando FormSubmit (sem precisar de contas ou chaves de API!)
        await fetch("https://formsubmit.co/ajax/samukactto@gmail.com", {
          method: "POST",
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            _subject: `📅 Novo Evento Agendado: ${eventTitle.trim()}`,
            mensagem: `Você marcou um evento para o dia ${format(selectedDay, "dd/MM/yyyy")}.`,
            evento: eventTitle.trim(),
            ativar_lembrete_oficial: gcalLink,
            _template: "box"
          })
        });
      }

      setEventTitle('');
      setSelectedDay(null);
    } catch (error) {
      console.error(error);
      showAlert('Erro ao criar evento.', 'Erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getEventsForDay = (date: Date) => {
    return events.filter(ev => {
      if (!ev.date) return false;
      const evDate = ev.date.toDate();
      return isSameDay(evDate, date);
    });
  };

  const now = startOfDay(new Date());
  const upcomingEvents = events
    .filter(ev => ev.date && ev.date.toDate() >= now)
    .sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
  
  const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Calendário</h2>
        <p className="page-subtitle">Organize seus eventos e seja lembrado por email.</p>
      </div>

      <div className="caixa-grid">
        <div className="card" style={{ gridColumn: 'span 4', height: 'fit-content' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={20} /> Próximo Evento
          </h3>
          {nextEvent ? (
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-color)' }}>{nextEvent.title}</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Data: {format(nextEvent.date.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              {nextEvent.remindEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  <Bell size={14} color="var(--accent-color)" /> Lembrete por email ativado
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum evento futuro agendado.</p>
          )}
        </div>

        <div className="card" style={{ gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 className="card-title" style={{ margin: 0, textTransform: 'capitalize' }}>
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handlePrevMonth} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'transparent', cursor: 'pointer' }}>
                <ChevronLeft size={20} />
              </button>
              <button onClick={handleNextMonth} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'transparent', cursor: 'pointer' }}>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="calendar-header-cell">{day}</div>
            ))}
            
            {prefixDays.map(i => (
              <div key={`prefix-${i}`} className="calendar-cell empty"></div>
            ))}

            {daysInMonth.map(day => {
              const dayEvents = getEventsForDay(day);
              const isTodayDate = isToday(day);
              
              return (
                <div 
                  key={day.toString()} 
                  className={`calendar-cell ${isTodayDate ? 'today' : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  <span className="calendar-day-num">{format(day, 'd')}</span>
                  <div className="calendar-cell-events">
                    {dayEvents.map(ev => (
                      <div key={ev.id} className="calendar-event-badge" title={ev.title}>
                        {ev.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDay && (
        <div className="modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">Novo Evento em {format(selectedDay, "dd/MM/yyyy")}</h3>
            <form onSubmit={handleAddEvent}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Nome do Evento</label>
                <input 
                  type="text"
                  required
                  autoFocus
                  className="filter-select" 
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Ex: Encomenda de 100 pasteis"
                />
              </div>
              <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="remindEmail" 
                  checked={remindEmail} 
                  onChange={(e) => setRemindEmail(e.target.checked)} 
                />
                <label htmlFor="remindEmail" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                  Receber lembrete por email
                </label>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setSelectedDay(null)} className="btn-more" style={{ padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.875rem' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading} style={{ padding: '8px 16px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  {loading ? 'Salvando...' : 'Adicionar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
