import { Request, Response, NextFunction } from 'express';
import { Client, xrpToDrops } from 'xrpl';
import crypto from 'crypto';

export interface AgentPayOptions {
  xrplNode: string;
  destinationAddress: string;
  requiredAmountXrp: string;
}

export interface PaymentPayload {
  version: string;
  paymentId: string;
  destination: string;
  amount: string;
  currency: string;
  expiresAt: number;
}

export function agentPayMiddleware(options: AgentPayOptions) {
  const client = new Client(options.xrplNode);
  const clientConnection = client.connect();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await clientConnection;
    const txHash = req.header('X-AgentPay-TxHash');

    // Caso 1: Sin prueba de pago -> Retornar HTTP 402 Payment Required
    if (!txHash) {
      const paymentId = `pay_${crypto.randomBytes(12).toString('hex')}`;
      const payload: PaymentPayload = {
        version: '1.0',
        paymentId,
        destination: options.destinationAddress,
        amount: options.requiredAmountXrp,
        currency: 'XRP',
        expiresAt: Math.floor(Date.now() / 1000) + 300 // Expiración en 5 minutos
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');

      res.setHeader('X-AgentPay-Payment-Request', encodedPayload);
      res.status(402).json({
        error: 'Payment Required',
        message: 'Provide valid XRPL payment hash in X-AgentPay-TxHash header.',
        paymentRequest: payload
      });
      return;
    }

    // Caso 2: Verificar la transacción en XRP Ledger
    try {
      const txResponse = await client.request({
        command: 'tx',
        transaction: txHash
      });
      const tx = txResponse.result;

      if (!tx.validated || tx.TransactionType !== 'Payment') {
        res.status(400).json({ error: 'Invalid or unconfirmed transaction' });
        return;
      }

      const expectedDrops = xrpToDrops(options.requiredAmountXrp);
      if (tx.Destination !== options.destinationAddress || tx.Amount !== expectedDrops) {
        res.status(400).json({ error: 'Transaction amount or destination mismatch' });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Failed to verify transaction on XRPL',
        details: (error as Error).message
      });
    }
  };
}
