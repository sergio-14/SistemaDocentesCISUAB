import { useState, useEffect }from 'react';
import { Link } from 'react-router-dom';
import api from '../apis/api';

const AdminDashboard = ({ user }) => {
    const displayName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Admin';
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/dashboard-stats/');
                setStats(response.data);
            } catch (error) {
                console.error("Error fetching dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const statItems = [
        { name: 'Usuarios', value: stats?.usuarios, icon: '👥', color: 'from-blue-400 to-blue-600', link: '/admin/usuarios' },
        { name: 'Docentes', value: stats?.docentes, icon: '👨‍🏫', color: 'from-green-400 to-green-600', link: '/admin/docentes' },
        { name: 'Carreras', value: stats?.carreras, icon: '🎓', color: 'from-purple-400 to-purple-600', link: '/admin/carreras' }
    ];

    return (
        <div className="animate-fade-in space-y-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 border-2 border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900/50 dark:to-indigo-900/50 flex items-center justify-center ring-4 ring-white dark:ring-slate-800">
                        <span className="text-4xl">⚙️</span>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-1">
                            Bienvenido, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">{displayName}</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 max-w-lg">
                            Este es el panel de control del sistema. A continuación, un resumen del estado actual.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border-2 border-slate-200 dark:border-slate-700 animate-pulse">
                            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-md mb-4"></div>
                            <div className="h-12 w-16 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
                        </div>
                    ))
                ) : (
                    statItems.map(item => (
                        <Link to={item.link} key={item.name} className="block bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg hover:shadow-xl border-2 border-slate-200 dark:border-slate-700 transition-all duration-300 hover:-translate-y-1 group">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">{item.name}</h3>
                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-xl shadow-md transition-transform duration-300 group-hover:scale-110`}>
                                    {item.icon}
                                </div>
                            </div>
                            <p className="text-5xl font-black text-slate-800 dark:text-white mt-2">{item.value ?? '...'}</p>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;