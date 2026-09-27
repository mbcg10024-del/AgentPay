import express from 'express';
import { agentPayMiddleware } from '../src/middleware';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Proteger la ruta '/api/data' requiriendo un pago en XRPL Testnet
app.get(
  '/api/data',
  agentPayMiddleware({
    xrplNode: 'wss://s.altnet.rippletest.net:51233',
    destinationAddress: 'rG1QQv2nh2gr13FC3S846ypgE52n7a284C', // Dirección de ejemplo en Testnet
    requiredAmountXrp: '0.001' // Pago requerido de 0.001 XRP por petición
  }),
  (req, res) => {
    res.json({
      status: 'success',
      data: 'Acceso autorizado. Este es el payload de datos protegido por AgentPay.'
    });
  }
);

app.listen(PORT, () => {
  console.log(`Servidor AgentPay ejecutándose en http://localhost:${PORT}`);
});
